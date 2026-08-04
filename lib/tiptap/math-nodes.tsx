import { Node as TiptapNode, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import katex from "katex";
import { clampPopoverToEditor } from "./popover-position";

type MathfieldElement = HTMLElement & {
  value: string;
  executeCommand: (command: string | [string, ...unknown[]]) => boolean;
};

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "math-field": React.DetailedHTMLProps<
        React.HTMLAttributes<MathfieldElement> & {
          "math-virtual-keyboard-policy"?: "auto" | "manual" | "sandboxed";
        },
        MathfieldElement
      >;
    }
  }
}

const MATH_MODE_STORAGE_KEY = "note-editor-math-mode";
type MathEditMode = "visual" | "latex";
function getStoredMathMode(): MathEditMode {
  if (typeof window === "undefined") return "visual";
  return window.localStorage.getItem(MATH_MODE_STORAGE_KEY) === "latex" ? "latex" : "visual";
}
function setStoredMathMode(mode: MathEditMode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MATH_MODE_STORAGE_KEY, mode);
}
function renderKatex(latex: string, displayMode: boolean) {
  try {
    return katex.renderToString(latex, { displayMode, throwOnError: false });
  } catch {
    return `<span class="text-clay">Invalid LaTeX</span>`;
  }
}

const MATH_SYMBOLS = [
  { label: "x²", insert: "^{}", caret: 2, title: "Superscript" },
  { label: "x₂", insert: "_{}", caret: 2, title: "Subscript" },
  { label: "√", insert: "\\sqrt{}", caret: 6, title: "Square root" },
  { label: "a/b", insert: "\\frac{}{}", caret: 6, title: "Fraction" },
  { label: "∑", insert: "\\sum_{}^{}", caret: 6, title: "Summation" },
  { label: "∫", insert: "\\int_{}^{}", caret: 6, title: "Integral" },
  { label: "π", insert: "\\pi", caret: 3, title: "Pi" },
  { label: "θ", insert: "\\theta", caret: 6, title: "Theta" },
  { label: "α", insert: "\\alpha", caret: 6, title: "Alpha" },
  { label: "β", insert: "\\beta", caret: 5, title: "Beta" },
  { label: "Δ", insert: "\\Delta", caret: 6, title: "Delta" },
  { label: "∞", insert: "\\infty", caret: 6, title: "Infinity" },
  { label: "±", insert: "\\pm", caret: 3, title: "Plus-minus" },
  { label: "×", insert: "\\times", caret: 6, title: "Times" },
  { label: "÷", insert: "\\div", caret: 4, title: "Divide" },
  { label: "≤", insert: "\\leq", caret: 4, title: "Less than or equal" },
  { label: "≥", insert: "\\geq", caret: 4, title: "Greater than or equal" },
  { label: "≠", insert: "\\neq", caret: 4, title: "Not equal" },
  { label: "≈", insert: "\\approx", caret: 7, title: "Approximately" },
] as const;

export type MathFieldHandle = { insert: (latex: string) => void; focus: () => void };

const MathFieldInput = forwardRef<
  MathFieldHandle,
  {
    initialValue: string;
    onValueChange: (v: string) => void;
    onCommit: (latex: string) => void;
    onCancel: () => void;
    autoFocusToken: string;
  }
>(function MathFieldInput(
  { initialValue, onValueChange, onCommit, onCancel, autoFocusToken },
  forwardedRef
) {
  const fieldRef = useRef<MathfieldElement | null>(null);
  const [ready, setReady] = useState(false);

  useImperativeHandle(forwardedRef, () => ({
    insert: (latex: string) => {
      try {
        fieldRef.current?.executeCommand(["insert", latex]);
        fieldRef.current?.focus();
      } catch {}
      if (fieldRef.current) onValueChange(fieldRef.current.value);
    },
    focus: () => {
      try {
        fieldRef.current?.focus();
      } catch {}
    },
  }));

  useEffect(() => {
    let cancelled = false;
    import("mathlive")
      .then(({ MathfieldElement }) => {
        MathfieldElement.fontsDirectory = "/mathlive-fonts";
        return customElements.whenDefined("math-field");
      })
      .then(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready || !fieldRef.current) return;
    if (fieldRef.current.value !== initialValue) fieldRef.current.value = initialValue;
  }, [ready, initialValue]);

  useEffect(() => {
    if (!ready) return;
    const raf = requestAnimationFrame(() => {
      try {
        fieldRef.current?.focus();
      } catch {}
    });
    return () => cancelAnimationFrame(raf);
  }, [ready, autoFocusToken]);

  if (!ready)
    return (
      <div className="min-w- w-full rounded border border-rule px-2 py-1.5 text-sm text-ink-soft">
        Loading…
      </div>
    );

  return (
    <math-field
      ref={fieldRef as any}
      className="min-w- w-full rounded border border-rule px-2 py-1.5 text-base outline-none focus:border-marigold"
      math-virtual-keyboard-policy="manual"
      onInput={(e: React.FormEvent<MathfieldElement>) =>
        onValueChange((e.currentTarget as MathfieldElement).value)
      }
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          onCommit(fieldRef.current?.value ?? "");
        }
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
        }
      }}
    />
  );
});

function makeMathView(displayMode: boolean) {
  return function MathView({
    node,
    updateAttributes,
    editor,
  }: {
    node: any;
    updateAttributes: (a: any) => void;
    editor: any;
  }) {
    const [editing, setEditing] = useState(false);
    const [mode, setMode] = useState<MathEditMode>("visual");
    const draftRef = useRef(node.attrs.latex ?? "");
    const [latexDraft, setLatexDraft] = useState(draftRef.current);
    const inputRef = useRef<HTMLInputElement>(null);
    const mathFieldRef = useRef<MathFieldHandle>(null);
    const anchorRef = useRef<HTMLDivElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);
    const [dragArmed, setDragArmed] = useState(false);
    const [portalPos, setPortalPos] = useState<{ top: number; left: number } | null>(null);

    useEffect(() => {
      setMode(getStoredMathMode());
    }, []);
    useEffect(() => {
      if (!editing) {
        draftRef.current = node.attrs.latex ?? "";
        setLatexDraft(draftRef.current);
      }
    }, [node.attrs.latex, editing]);

    useLayoutEffect(() => {
      if (!editing || !anchorRef.current) return;
      const rect = anchorRef.current.getBoundingClientRect();
      setPortalPos({ top: rect.bottom + 6, left: rect.left });
      requestAnimationFrame(() => {
        if (popupRef.current) clampPopoverToEditor(popupRef.current, editor?.view?.dom ?? null);
      });
    }, [editing, editor, latexDraft]);

    useEffect(() => {
      if (!editing) return;
      const isMathliveUi = (n: globalThis.Node) =>
        n instanceof Element && (n.closest?.('[class*="ML__"]') || n.tagName === "MATH-FIELD");
      const onDown = (e: globalThis.MouseEvent) => {
        const path = (e as any).composedPath?.() as globalThis.Node[] | undefined;
        const target = e.target as unknown as globalThis.Node;
        const inside = path
          ? path.some(
              (n) =>
                n === popupRef.current ||
                n === anchorRef.current ||
                (n instanceof Element &&
                  (popupRef.current?.contains(n as globalThis.Node) ||
                    anchorRef.current?.contains(n as globalThis.Node))) ||
                isMathliveUi(n)
            )
          : !!(
              popupRef.current?.contains(target) ||
              anchorRef.current?.contains(target) ||
              isMathliveUi(target)
            );
        if (inside) return;
        updateAttributes({ latex: draftRef.current });
        setEditing(false);
      };
      document.addEventListener("mousedown", onDown, true);
      return () => document.removeEventListener("mousedown", onDown, true);
    }, [editing, updateAttributes]);

    const handleCommit = useCallback(() => {
      updateAttributes({ latex: draftRef.current });
      setEditing(false);
    }, [updateAttributes]);
    const handleCancel = useCallback(() => {
      draftRef.current = node.attrs.latex ?? "";
      setLatexDraft(draftRef.current);
      setEditing(false);
    }, [node.attrs.latex]);

    function insertSymbolLatex(insert: string, caret: number) {
      const el = inputRef.current;
      const start = el?.selectionStart ?? latexDraft.length;
      const end = el?.selectionEnd ?? latexDraft.length;
      const next = latexDraft.slice(0, start) + insert + latexDraft.slice(end);
      draftRef.current = next;
      setLatexDraft(next);
      const cursor = start + caret;
      requestAnimationFrame(() => {
        el?.focus();
        el?.setSelectionRange(cursor, cursor);
      });
    }
    function insertSymbol(insert: string, caret: number) {
      if (mode === "visual") mathFieldRef.current?.insert(insert);
      else insertSymbolLatex(insert, caret);
    }

    const popup =
      editing && portalPos
        ? createPortal(
            <div
              ref={popupRef}
              style={{ position: "fixed", top: portalPos.top, left: portalPos.left }}
              className="max-w- z-[100] w-max rounded-md border border-marigold bg-white p-2 shadow-lg"
              onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
              onKeyDown={(e: React.KeyboardEvent) => e.stopPropagation()}
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <div className="flex flex-wrap gap-0.5">
                  {MATH_SYMBOLS.map((sym) => (
                    <button
                      key={sym.label}
                      type="button"
                      title={sym.title}
                      onMouseDown={(e: React.MouseEvent) => e.preventDefault()}
                      onClick={() => insertSymbol(sym.insert, sym.caret)}
                      className="min-w-[1.75rem] rounded px-1 py-0.5 font-serif text-sm text-ink hover:bg-paper"
                    >
                      {sym.label}
                    </button>
                  ))}
                </div>
                <div className="flex shrink-0 rounded border border-rule text-xs">
                  <button
                    type="button"
                    onMouseDown={(e: React.MouseEvent) => e.preventDefault()}
                    onClick={() => {
                      setMode("visual");
                      setStoredMathMode("visual");
                    }}
                    className={`rounded-l px-1.5 py-0.5 ${mode === "visual" ? "bg-marigold/30" : "text-ink-soft"}`}
                  >
                    Visual
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e: React.MouseEvent) => e.preventDefault()}
                    onClick={() => {
                      setMode("latex");
                      setStoredMathMode("latex");
                    }}
                    className={`rounded-r border-l px-1.5 py-0.5 ${mode === "latex" ? "bg-marigold/30" : "text-ink-soft"}`}
                  >
                    LaTeX
                  </button>
                </div>
              </div>
              {mode === "visual" ? (
                <MathFieldInput
                  ref={mathFieldRef}
                  initialValue={draftRef.current}
                  onValueChange={(v) => {
                    draftRef.current = v;
                  }}
                  autoFocusToken={mode + String(editing)}
                  onCommit={(l) => {
                    draftRef.current = l;
                    handleCommit();
                  }}
                  onCancel={handleCancel}
                />
              ) : (
                <>
                  <input
                    ref={inputRef}
                    autoFocus
                    value={latexDraft}
                    onChange={(e) => {
                      draftRef.current = e.target.value;
                      setLatexDraft(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleCommit();
                      }
                      if (e.key === "Escape") handleCancel();
                    }}
                    className="min-w- w-full rounded border border-rule px-2 py-1 font-mono text-sm outline-none focus:border-marigold"
                  />
                  {latexDraft.trim() && (
                    <div
                      className="mt-1.5 border-t border-rule pt-1.5 text-sm"
                      dangerouslySetInnerHTML={{ __html: renderKatex(latexDraft, displayMode) }}
                    />
                  )}
                </>
              )}
            </div>,
            document.body
          )
        : null;

    if (editing) {
      return (
        <>
          <NodeViewWrapper
            as="div"
            ref={anchorRef as any}
            draggable={false}
            className={displayMode ? "relative my-2" : "relative inline-block align-middle"}
            contentEditable={false}
          >
            {!displayMode && (
              <span className="rounded bg-marigold/20 px-1 font-mono text-sm text-ink">
                {draftRef.current.trim() ? "∑" : "$…$"}
              </span>
            )}
            {displayMode && (
              <span className="rounded bg-marigold/20 px-1 font-mono text-sm text-ink">$$…$$</span>
            )}
          </NodeViewWrapper>
          {popup}
        </>
      );
    }

    if (!displayMode) {
      if (!node.attrs.latex?.trim())
        return (
          <NodeViewWrapper
            as="span"
            className="cursor-pointer rounded bg-marigold/20 px-1 font-mono text-sm text-ink-soft hover:bg-marigold/30"
            onClick={() => {
              draftRef.current = node.attrs.latex ?? "";
              setLatexDraft(draftRef.current);
              setEditing(true);
            }}
            contentEditable={false}
          >
            $…$
          </NodeViewWrapper>
        );
      return (
        <NodeViewWrapper
          as="span"
          className="cursor-pointer rounded px-0.5 hover:bg-paper"
          onClick={() => setEditing(true)}
          contentEditable={false}
          dangerouslySetInnerHTML={{ __html: renderKatex(node.attrs.latex, displayMode) }}
        />
      );
    }

    return (
      <NodeViewWrapper
        as="div"
        className="group relative my-2 rounded-lg border border-transparent p-2 hover:border-rule"
        draggable={dragArmed}
        onDragEnd={() => setDragArmed(false)}
      >
        <button
          type="button"
          onMouseDown={() => setDragArmed(true)}
          onMouseUp={() => setDragArmed(false)}
          data-drag-handle
          className="absolute -left-6 top-2 hidden h-6 w-6 cursor-grab select-none items-center justify-center rounded text-ink-soft hover:bg-paper active:cursor-grabbing group-hover:flex"
        >
          ⠿
        </button>
        <div
          ref={anchorRef as any}
          onClick={() => setEditing(true)}
          contentEditable={false}
          className="cursor-pointer"
          dangerouslySetInnerHTML={{
            __html: renderKatex(node.attrs.latex || "$$…$$", displayMode),
          }}
        />
        {popup}
      </NodeViewWrapper>
    );
  };
}

function defineMathNode(name: "mathInline" | "mathBlock", displayMode: boolean) {
  return TiptapNode.create({
    name,
    group: displayMode ? "block" : "inline",
    inline: !displayMode,
    atom: true,
    draggable: displayMode,
    addAttributes() {
      return { latex: { default: "" } };
    },
    parseHTML() {
      return [
        {
          tag: `${displayMode ? "div" : "span"}[data-math="${name}"]`,
          getAttrs: (el) => ({ latex: (el as HTMLElement).textContent ?? "" }),
        },
      ];
    },
    renderHTML({ node }) {
      return [
        displayMode ? "div" : "span",
        mergeAttributes({ "data-math": name }),
        node.attrs.latex,
      ];
    },
    addNodeView() {
      return ReactNodeViewRenderer(makeMathView(displayMode), { stopEvent: () => true });
    },
  });
}

export const MathInline = defineMathNode("mathInline", false);
export const MathBlock = defineMathNode("mathBlock", true);

export function mathInlineMarkdownPlugin(md: any) {
  md.inline.ruler.before("escape", "math_inline", (state: any, silent: boolean) => {
    const src = state.src,
      pos = state.pos;
    if (src[pos] !== "$") return false;
    if (src[pos + 1] === "$") return false;
    if (pos > 0 && src[pos - 1] === "\\") return false;
    const opening = src[pos + 1];
    if (!opening || /\s/.test(opening)) return false;
    let end = pos + 1;
    for (;;) {
      end = src.indexOf("$", end);
      if (end === -1) return false;
      if (src[end - 1] === "\\") {
        end += 1;
        continue;
      }
      break;
    }
    if (/\s/.test(src[end - 1])) return false;
    const latex = src.slice(pos + 1, end);
    if (!latex || /\n\s*\n/.test(latex)) return false;
    if (!silent) {
      const t = state.push("math_inline", "", 0);
      t.attrs = [["latex", latex]];
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
      let nextLine = startLine + 1,
        found = false;
      while (nextLine < endLine) {
        const ls = state.bMarks[nextLine] + state.tShift[nextLine],
          le = state.eMarks[nextLine];
        if (state.src.slice(ls, le).trim() === "$$") {
          found = true;
          break;
        }
        nextLine++;
      }
      if (!found) return false;
      if (silent) return true;
      const cs = state.bMarks[startLine + 1] ?? start + 2,
        ce = state.bMarks[nextLine],
        latex = state.src.slice(cs, ce).trim();
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
MathInline.config.addStorage = function () {
  return {
    markdown: {
      serialize(s: any, n: any) {
        s.write(`$${n.attrs.latex}$`);
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
      serialize(s: any, n: any) {
        s.write(`\n$$\n${n.attrs.latex}\n$$\n`);
      },
      parse: {
        setup(md: any) {
          mathBlockMarkdownPlugin(md);
        },
      },
    },
  };
};
