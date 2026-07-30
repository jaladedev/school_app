/**
 * ResourceChip — a TipTap inline atom node that stands in for the
 * `[[resource:UUID]]` markers the app already stores in markdown.
 *
 * Why an inline atom node instead of, say, a plain text token:
 * - It renders as a real chip (icon + title) in the WYSIWYG surface,
 *   which is the whole point of this migration (#6 on the to-do).
 * - "Atom" means TipTap treats it as a single indivisible unit — a
 *   teacher can't accidentally type inside the middle of a UUID and
 *   corrupt the marker, and backspace deletes the whole chip in one go.
 * - It round-trips to/from the exact same `[[resource:UUID]]` text via
 *   the markdown serializer below, so `saveTopicNote` and every existing
 *   reader (TopicContent.tsx, notifications, etc.) keeps working
 *   unmodified. No DB or backend changes needed for this piece.
 *
 * Resource metadata (title, type, icon) is NOT stored on the node --
 * only the id is. The node looks up the live resource from the
 * `resourceMap` passed in via editor storage (see NoteEditor.tsx), the
 * same way the old textarea version resolved markers against `resources`
 * for the chip strip. This means a rename/delete elsewhere is reflected
 * next render without re-serializing the doc.
 */
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import { useState } from "react";
import { TopicResourceItem } from "@/components/TopicContent";
import type { TopicResource } from "@/types/database";

export const RESOURCE_TYPE_ICON: Record<TopicResource["resource_type"], string> = {
  image: "🖼️",
  diagram_mermaid: "📊",
  video: "🎬",
  pdf: "📄",
  link: "🔗",
  audio: "🎧",
};

const RESOURCE_MARKER_RE = /\[\[resource:([0-9a-fA-F-]{36})\]\]/;

export interface ResourceChipStorage {
  resources: TopicResource[];
  onRemove?: (id: string) => void;
}

// tiptap-markdown's Markdown extension augments core Storage with a
// `markdown` key; ResourceChip augments it with `resourceChip`. Declaring
// this here (instead of casting at every call site) keeps
// `editor.storage.resourceChip` type-checked the same way
// `editor.storage.markdown` already is.
declare module "@tiptap/core" {
  interface Storage {
    resourceChip: ResourceChipStorage;
  }
}

function ResourceChipView({
  node,
  editor,
  deleteNode,
}: {
  node: any;
  editor: any;
  deleteNode: () => void;
}) {
  const id: string = node.attrs.id;
  const storage: ResourceChipStorage = editor.storage.resourceChip ?? { resources: [] };
  const resource = storage.resources.find((r) => r.id === id) ?? null;
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  function closePopover() {
    setPreviewOpen(false);
    setConfirmingRemove(false);
  }

  return (
    <NodeViewWrapper as="span" className="relative inline-flex align-middle">
      <button
        type="button"
        onClick={() => {
          setPreviewOpen((open) => !open);
          setConfirmingRemove(false);
        }}
        className={`mx-0.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
          resource
            ? "border-rule bg-paper text-ink hover:border-marigold"
            : "border-clay/40 bg-clay/10 text-clay"
        }`}
        contentEditable={false}
        data-resource-id={id}
        title={resource ? "Click to preview or remove" : "This resource no longer exists"}
      >
        <span aria-hidden>{resource ? RESOURCE_TYPE_ICON[resource.resource_type] : "⚠️"}</span>
        <span className="max-w-[9rem] truncate">
          {resource ? (resource.title ?? "Untitled resource") : "Missing resource"}
        </span>
      </button>

      {previewOpen && (
        <span
          contentEditable={false}
          className="absolute left-0 top-full z-20 mt-1 w-[28rem] max-w-[90vw] rounded-lg border border-rule bg-white p-4 shadow-xl"
        >
          {resource ? (
            <span className="block max-h-[28rem] overflow-y-auto [&_figure]:my-0 [&_img]:max-h-96 [&_img]:w-full [&_img]:object-contain">
              <TopicResourceItem resource={resource} />
            </span>
          ) : (
            <span className="block text-sm text-clay">
              This resource was deleted elsewhere. Remove this marker or pick a replacement from
              &quot;Insert resource&quot;.
            </span>
          )}

          {confirmingRemove ? (
            <span className="mt-3 flex items-center justify-between gap-2 rounded-md border border-clay/40 bg-clay/10 p-2">
              <span className="text-xs text-clay">Remove this from the note?</span>
              <span className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmingRemove(false)}
                  className="text-xs text-ink-soft hover:underline"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => deleteNode()}
                  className="rounded bg-clay px-2 py-1 text-xs font-medium text-white hover:bg-clay/90"
                >
                  Remove
                </button>
              </span>
            </span>
          ) : (
            <span className="mt-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={closePopover}
                className="text-xs text-ink-soft hover:underline"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => setConfirmingRemove(true)}
                className="text-xs font-medium text-clay hover:underline"
              >
                Remove from note
              </button>
            </span>
          )}
        </span>
      )}
    </NodeViewWrapper>
  );
}

export const ResourceChip = Node.create({
  name: "resourceChip",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      id: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-resource-id]",
        getAttrs: (el) => ({ id: (el as HTMLElement).getAttribute("data-resource-id") }),
      },
    ];
  },

  renderHTML({ node }) {
    return ["span", mergeAttributes({ "data-resource-id": node.attrs.id })];
  },

  addNodeView() {
    // Without this, clicking the chip (an atom node) makes ProseMirror
    // establish its own NodeSelection over it before our onClick even
    // runs. That selection change, combined with BubbleMenu's live
    // position tracking, is the likely source of a
    // "Selection passed to setSelection must point at the current
    // document" crash when the popover opens/closes and re-renders the
    // wrapper. Returning true from stopEvent for anything originating
    // inside this node view tells ProseMirror to leave the DOM event
    // alone entirely and let React handle it instead.
    return ReactNodeViewRenderer(ResourceChipView, {
      stopEvent: () => true,
    });
  },

  addStorage() {
    return { resources: [] as TopicResource[] } as ResourceChipStorage;
  },

  // --- markdown round-trip -------------------------------------------
  // tiptap-markdown lets a node register serialize/parse hooks here.
  // Serialize: node -> "[[resource:ID]]" text, identical to what the old
  // textarea produced, so saveTopicNote's stored markdown is unchanged.
  addOptions() {
    return {};
  },
});

// tiptap-markdown parses via markdown-it. Register an inline rule that
// recognizes [[resource:UUID]] and turns it into a resourceChip token.
// This function is called once when building the editor's markdown
// extension (see NoteEditor.tsx) rather than living inside the Node
// definition, because markdown-it plugin registration needs the `md`
// instance, not the TipTap schema.
export function resourceMarkdownPlugin(md: any) {
  md.inline.ruler.before("link", "resource_chip", (state: any, silent: boolean) => {
    const match = RESOURCE_MARKER_RE.exec(state.src.slice(state.pos));
    if (!match || match.index !== 0) return false;
    if (!silent) {
      const token = state.push("resource_chip", "", 0);
      token.attrs = [["id", match[1]]];
    }
    state.pos += match[0].length;
    return true;
  });

  md.renderer.rules.resource_chip = (tokens: any[], idx: number) => {
    const id = tokens[idx].attrs.find((a: string[]) => a[0] === "id")[1];
    return `<span data-resource-id="${id}"></span>`;
  };
}

// Serializer + parser side: tiptap-markdown reads `storage.markdown` off
// each extension -- `serialize` when walking the doc back to a string on
// save, and `parse.setup(markdownit)` once when building the editor's
// markdown-it instance on mount. There's no separate global "markdownIt"
// option on the Markdown extension; per-node registration is the actual
// supported hook, so `resourceMarkdownPlugin` runs from here instead of
// being passed into `Markdown.configure()` in NoteEditor.tsx.
ResourceChip.config.addStorage = function () {
  return {
    resources: [] as TopicResource[],
    markdown: {
      serialize(state: any, node: any) {
        state.write(`[[resource:${node.attrs.id}]]`);
      },
      parse: {
        setup(md: any) {
          resourceMarkdownPlugin(md);
        },
      },
    },
  };
};
