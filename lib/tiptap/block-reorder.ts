import { Extension } from "@tiptap/core";
import type { CommandProps } from "@tiptap/core";
import { Selection } from "@tiptap/pm/state";
import type { EditorState } from "@tiptap/pm/state";
import type { Node as PMNode } from "@tiptap/pm/model";

// Keyboard equivalent of the drag-handle reordering built for Section,
// Callout, CodeBlock, and MathBlock (see drag-utils.ts). Those are all
// mouse-only -- a keyboard/screen-reader user has no way to reorder a
// block at all today. Alt+Up/Down swaps the block containing the cursor
// with its previous/next sibling, mirroring what a drag-handle drop
// would do one position at a time.
//
// ResourceChip is deliberately left out: it's an *inline* node (lives
// inside a paragraph's content, not as a block sibling), so "move up/
// down" would mean something different for it (swap with an adjacent
// inline sibling within the same paragraph) rather than this block-swap
// logic. Tracked as a follow-up in markdown-editor-todo.md rather than
// folded in here.
const DRAGGABLE_BLOCK_TYPES = new Set(["section", "callout", "codeBlock", "mathBlock"]);

// Walks up from the cursor to the shallowest ancestor whose type is one
// of the draggable block types (not the innermost block -- e.g. cursor
// in a paragraph inside a callout inside a section should move the
// callout, not the paragraph, and shallowest-first picks the section
// over the callout if both wrap the cursor).
function findDraggableAncestorDepth(state: EditorState): number | null {
  const { $from } = state.selection;
  for (let depth = 1; depth <= $from.depth; depth++) {
    if (DRAGGABLE_BLOCK_TYPES.has($from.node(depth).type.name)) return depth;
  }
  return null;
}

function moveBlock(direction: "up" | "down") {
  return ({ state, dispatch, tr }: CommandProps): boolean => {
    const depth = findDraggableAncestorDepth(state);
    if (depth === null) return false;

    const { $from } = state.selection;
    const parent = $from.node(depth - 1);
    const index = $from.index(depth - 1);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= parent.childCount) return false;

    const currentNode = $from.node(depth);
    const siblingNode = parent.child(targetIndex);
    const posBeforeCurrent = $from.before(depth);
    const posAfterCurrent = $from.after(depth);

    let from: number;
    let to: number;
    let content: PMNode[];
    let newCurrentStart: number;

    if (direction === "up") {
      from = posBeforeCurrent - siblingNode.nodeSize;
      to = posAfterCurrent;
      content = [currentNode, siblingNode];
      newCurrentStart = from;
    } else {
      from = posBeforeCurrent;
      to = posAfterCurrent + siblingNode.nodeSize;
      content = [siblingNode, currentNode];
      newCurrentStart = posBeforeCurrent + siblingNode.nodeSize;
    }

    if (dispatch) {
      tr.replaceWith(from, to, content);
      // Keep the cursor with the block that moved, rather than letting
      // ProseMirror's default position-mapping leave it wherever the
      // old coordinates happen to land after the swap.
      const resolved = tr.doc.resolve(Math.min(newCurrentStart + 1, tr.doc.content.size));
      tr.setSelection(Selection.near(resolved));
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

export const BlockReorderShortcuts = Extension.create({
  name: "blockReorderShortcuts",

  addKeyboardShortcuts() {
    return {
      "Alt-ArrowUp": () => this.editor.commands.command(moveBlock("up")),
      "Alt-ArrowDown": () => this.editor.commands.command(moveBlock("down")),
      // Mod-Alt variants too -- plain Alt+Arrow is taken by some window
      // managers/browsers for tab or history navigation.
      "Mod-Alt-ArrowUp": () => this.editor.commands.command(moveBlock("up")),
      "Mod-Alt-ArrowDown": () => this.editor.commands.command(moveBlock("down")),
    };
  },
});
