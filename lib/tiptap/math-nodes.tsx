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
      // Same fix as ResourceChip (see resource-node.tsx): without this,
      // clicking to edit the equation makes ProseMirror establish its
      // own NodeSelection over this atom node before our onClick runs,
      // which can crash BubbleMenu's live position tracking when the
      // node view swaps between rendered/editing state.
      return ReactNodeViewRenderer(makeMathView(displayMode), {
        stopEvent: () => true,
      });
    },
  });
}

export const MathInline = defineMathNode("mathInline", false);
export const MathBlock = defineMathNode("mathBlock", true);

// markdown-it rules: recognize $...$ (inline) and a $$ ... $$ block that
// sits on its own lines. These need to match remark-math's actual
// grammar (the preview pane, TopicContent.tsx and QuestionText.tsx, both
// parse saved notes with remark-math/rehype-katex) or content written in
// one place can silently fail to render as math in the other.
//
// remark-math's inline rule (see micromark-extension-math) is NOT just
// "text between the next two $ signs." In particular it requires:
//  - the opening `$` is not immediately followed by whitespace
//  - the closing `$` is not immediately preceded by whitespace
//  - a `\$` is an escape, not a delimiter
// That flanking rule is what stops ordinary currency text like
// "It costs $5 or $10" from being swallowed as `5 or ` -- the closing
// `$` in "$10" is preceded by a space, so it's rejected and both `$`
// stay literal, matching what remark-math does.
export function mathInlineMarkdownPlugin(md: any) {
  md.inline.ruler.before("escape", "math_inline", (state: any, silent: boolean) => {
    const src = state.src;
    const pos = state.pos;
    if (src[pos] !== "$") return false;
    if (src[pos + 1] === "$") return false; // "$$" is the block form, not inline
    if (pos > 0 && src[pos - 1] === "\\") return false; // \$ is an escape

    const opening = src[pos + 1];
    if (!opening || /\s/.test(opening)) return false; // no space right after "$"

    let end = pos + 1;
    for (;;) {
      end = src.indexOf("$", end);
      if (end === -1) return false;
      if (src[end - 1] === "\\") {
        end += 1; // escaped "$" inside the span, keep searching
        continue;
      }
      break;
    }
    if (/\s/.test(src[end - 1])) return false; // no space right before "$"

    const latex = src.slice(pos + 1, end);
    if (!latex || /\n\s*\n/.test(latex)) return false; // don't span a blank line

    if (!silent) {
      const token = state.push("math_inline", "", 0);
      token.attrs = [["latex", latex]];
    }
    state.pos = end + 1;
    return true;
  });

  md.renderer.rules.math_inline = (tokens: any[], idx: number) =>
    `<span data-math="mathInline">${tokens[idx].attrs.find((a: string[]) => a[0] === "latex")[1]}</span>`;
}

export function mathBlockMarkdownPlugin(md: any) {
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

  md.renderer.rules.math_block = (tokens: any[], idx: number) =>
    `<div data-math="mathBlock">${tokens[idx].attrs.find((a: string[]) => a[0] === "latex")[1]}</div>`;
}

// Serialize + parse wiring, same mechanism as ResourceChip: tiptap-markdown
// reads `storage.markdown` off each extension directly, there's no global
// "markdownIt" callback on the Markdown extension itself.
MathInline.config.addStorage = function () {
  return {
    markdown: {
      serialize(state: any, node: any) {
        state.write(`$${node.attrs.latex}$`);
      },
      parse: {
        setup(md: any) {
          mathInlineMarkdownPlugin(md);
        },
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
      parse: {
        setup(md: any) {
          mathBlockMarkdownPlugin(md);
        },
      },
    },
  };
};
