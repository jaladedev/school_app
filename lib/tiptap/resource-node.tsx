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
import { MermaidDiagram } from "@/components/MermaidDiagram";
import { updateMermaidResource } from "@/lib/actions/teacher";
import { emitToast } from "@/lib/toast";
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
  onResourceUpdated?: (resource: TopicResource) => void;
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

  if (resource?.resource_type === "diagram_mermaid") {
    return <MermaidNodeView resource={resource} deleteNode={deleteNode} editor={editor} />;
  }

  return <ResourceChipDefaultView id={id} resource={resource} deleteNode={deleteNode} />;
}

// Mermaid diagrams get their own inline rendering instead of hiding
// behind a click-to-preview chip -- this is the "NodeView wrapping
// MermaidDiagram directly in the doc" piece flagged as not-yet-shipped
// in #0/#18 of the to-do. The node itself is still schema-`inline`
// (see ResourceChip.group below) so no new markdown grammar or DB
// round-trip is needed -- `as="div"` just makes it lay out visually as
// a full-width block within its paragraph, the same trick most rich
// text editors use for "atom" images.
function MermaidNodeView({
  resource,
  deleteNode,
  editor,
}: {
  resource: TopicResource;
  deleteNode: () => void;
  editor: any;
}) {
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(resource.title ?? "");
  const [code, setCode] = useState(resource.content ?? "");
  const [isSaving, setIsSaving] = useState(false);

  function startEditing() {
    setTitle(resource.title ?? "");
    setCode(resource.content ?? "");
    setEditing(true);
  }

  async function handleSave() {
    if (!code.trim()) {
      emitToast("Write some Mermaid code before saving.", "error");
      return;
    }
    setIsSaving(true);
    try {
      const updated = await updateMermaidResource(resource.id, title, code);
      const storage: ResourceChipStorage = editor.storage.resourceChip ?? { resources: [] };
      storage.onResourceUpdated?.(updated);
      emitToast("Diagram updated.");
      setEditing(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unable to update the diagram.";
      emitToast(message, "error");
    } finally {
      setIsSaving(false);
    }
  }

  if (editing) {
    return (
      <NodeViewWrapper
        as="div"
        className="my-3 rounded-xl border border-marigold bg-white p-4"
        contentEditable={false}
      >
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Diagram title (optional)"
          className="mb-2 w-full rounded-lg border border-rule bg-white p-2 text-sm text-ink outline-none focus-visible:border-marigold"
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-soft">
              Mermaid code
            </p>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              rows={8}
              className="w-full rounded-lg border border-rule bg-white p-3 font-mono text-sm text-ink outline-none focus-visible:border-marigold"
            />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-soft">
              Preview
            </p>
            <div className="h-full min-h-[8rem] rounded-lg border border-rule bg-paper p-2">
              <MermaidDiagram code={code} title={title || undefined} />
            </div>
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setEditing(false)}
            disabled={isSaving}
            className="rounded-lg border border-rule px-3 py-1.5 text-sm text-ink hover:bg-paper disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-lg bg-marigold px-3 py-1.5 text-sm font-medium text-ink hover:bg-marigold-dark disabled:opacity-60"
          >
            {isSaving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper as="div" className="group relative my-3" contentEditable={false}>
      <TopicResourceItem resource={resource} />

      <div className="absolute right-2 top-2 flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
        {confirmingRemove ? (
          <div className="flex items-center gap-2 rounded-md border border-clay/40 bg-white p-1.5 shadow">
            <span className="text-xs text-clay">Remove diagram?</span>
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
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={startEditing}
              title="Edit this diagram's code"
              className="rounded-full border border-rule bg-white px-2 py-1 text-xs text-ink shadow hover:border-marigold"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setConfirmingRemove(true)}
              title="Remove diagram from note"
              className="rounded-full border border-rule bg-white px-2 py-1 text-xs text-clay shadow hover:border-clay/40"
            >
              Remove
            </button>
          </>
        )}
      </div>
    </NodeViewWrapper>
  );
}

function ResourceChipDefaultView({
  id,
  resource,
  deleteNode,
}: {
  id: string;
  resource: TopicResource | null;
  deleteNode: () => void;
}) {
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
