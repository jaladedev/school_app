import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import { useState } from "react";
import katex from "katex";

function renderKatex(latex: string, displayMode: boolean) {
  try {
    return katex.renderToString(latex, { displayMode, throwOnError: false });
  } catch {
    return `<span class="text-clay">Invalid LaTeX</span>`;
  }
}

function makeMathView(displayMode: boolean) {
  return function MathView({
    node,
    updateAttributes,
  }: {
    node: any;
    updateAttributes: (attrs: any) => void;
  }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(node.attrs.latex ?? "");

    if (editing) {
      return (
        <NodeViewWrapper as={displayMode ? "div" : "span"}>
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              updateAttributes({ latex: draft });
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                updateAttributes({ latex: draft });
                setEditing(false);
              }
              if (e.key === "Escape") {
                setDraft(node.attrs.latex ?? "");
                setEditing(false);
              }
            }}
            className="rounded border border-marigold px-2 py-1 font-mono text-sm outline-none"
            placeholder={displayMode ? "\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}" : "x^2 + 3x - 4 = 0"}
          />
        </NodeViewWrapper>
      );
    }

    return (
      <NodeViewWrapper
        as={displayMode ? "div" : "span"}
        className={
          displayMode
            ? "my-2 cursor-pointer rounded-lg border border-transparent p-2 hover:border-rule"
            : "cursor-pointer rounded px-0.5 hover:bg-paper"
        }
        onClick={() => setEditing(true)}
        contentEditable={false}
        dangerouslySetInnerHTML={{ __html: renderKatex(node.attrs.latex || "\\,", displayMode) }}
      />
    );
  };
}

function defineMathNode(name: "mathInline" | "mathBlock", displayMode: boolean) {
  return Node.create({
    name,
    group: displayMode ? "block" : "inline",
    inline: !displayMode,
    atom: true,

    addAttributes() {
      return { latex: { default: "" } };
    },

    parseHTML() {
      return [{ tag: `${displayMode ? "div" : "span"}[data-math="${name}"]` }];
    },

    renderHTML({ node }) {
      return [
        displayMode ? "div" : "span",
        mergeAttributes({ "data-math": name }),
        node.attrs.latex,
      ];
    },

    addNodeView() {
      return ReactNodeViewRenderer(makeMathView(displayMode));
    },
  });
}

export const MathInline = defineMathNode("mathInline", false);
export const MathBlock = defineMathNode("mathBlock", true);

// markdown-it rules: recognize $...$ (inline) and a $$ ... $$ block that
// sits on its own lines, matching the remarkMath conventions the preview
// pane already used -- so existing saved notes parse into the new editor
// without a migration script.
export function mathMarkdownPlugin(md: any) {
  md.inline.ruler.before("escape", "math_inline", (state: any, silent: boolean) => {
    if (state.src[state.pos] !== "$") return false;
    const end = state.src.indexOf("$", state.pos + 1);
    if (end === -1) return false;
    const latex = state.src.slice(state.pos + 1, end);
    if (!silent) {
      const token = state.push("math_inline", "", 0);
      token.attrs = [["latex", latex]];
    }
    state.pos = end + 1;
    return true;
  });

  md.block.ruler.before(
    "fence",
    "math_block",
    (state: any, startLine: number, endLine: number, silent: boolean) => {
      const start = state.bMarks[startLine] + state.tShift[startLine];
      if (state.src.slice(start, start + 2) !== "$$") return false;

      let nextLine = startLine + 1;
      let found = false;
      while (nextLine < endLine) {
        const lineStart = state.bMarks[nextLine] + state.tShift[nextLine];
        const lineEnd = state.eMarks[nextLine];
        if (state.src.slice(lineStart, lineEnd).trim() === "$$") {
          found = true;
          break;
        }
        nextLine++;
      }
      if (!found) return false;
      if (silent) return true;

      const contentStart = state.bMarks[startLine + 1] ?? start + 2;
      const contentEnd = state.bMarks[nextLine];
      const latex = state.src.slice(contentStart, contentEnd).trim();

      const token = state.push("math_block", "", 0);
      token.attrs = [["latex", latex]];
      token.map = [startLine, nextLine + 1];
      state.line = nextLine + 1;
      return true;
    }
  );

  md.renderer.rules.math_inline = (tokens: any[], idx: number) =>
    `<span data-math="mathInline">${tokens[idx].attrs.find((a: string[]) => a[0] === "latex")[1]}</span>`;
  md.renderer.rules.math_block = (tokens: any[], idx: number) =>
    `<div data-math="mathBlock">${tokens[idx].attrs.find((a: string[]) => a[0] === "latex")[1]}</div>`;
}

// Serializers, attached the same way as ResourceChip's.
MathInline.config.addStorage = function () {
  return {
    markdown: {
      serialize(state: any, node: any) {
        state.write(`$${node.attrs.latex}$`);
      },
    },
  };
};
MathBlock.config.addStorage = function () {
  return {
    markdown: {
      serialize(state: any, node: any) {
        state.write(`\n$$\n${node.attrs.latex}\n$$\n`);
      },
    },
  };
};
