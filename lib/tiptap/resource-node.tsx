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

function ResourceChipView({ node, editor }: { node: any; editor: any }) {
  const id: string = node.attrs.id;
  const storage: ResourceChipStorage = editor.storage.resourceChip ?? { resources: [] };
  const resource = storage.resources.find((r) => r.id === id) ?? null;

  return (
    <NodeViewWrapper as="span" className="inline-flex align-middle">
      <span
        className={`mx-0.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
          resource ? "border-rule bg-paper text-ink" : "border-clay/40 bg-clay/10 text-clay"
        }`}
        contentEditable={false}
        data-resource-id={id}
      >
        <span aria-hidden>{resource ? RESOURCE_TYPE_ICON[resource.resource_type] : "⚠️"}</span>
        <span className="max-w-[9rem] truncate">
          {resource ? (resource.title ?? "Untitled resource") : "Missing resource"}
        </span>
      </span>
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
    return ReactNodeViewRenderer(ResourceChipView);
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

// Serializer side: tiptap-markdown calls each node's toMarkdown (if
// present) when walking the doc back to a string on save.
ResourceChip.config.addStorage = function () {
  return {
    resources: [] as TopicResource[],
    markdown: {
      serialize(state: any, node: any) {
        state.write(`[[resource:${node.attrs.id}]]`);
      },
    },
  };
};
