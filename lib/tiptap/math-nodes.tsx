import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import katex from "katex";
import { dragAwareStopEvent } from "./drag-utils";
import { clampPopoverToEditor } from "./popover-position";

// MathLive registers the <math-field> custom element as a side effect of
// being imported. It touches `document`/`customElements` at module scope,
// so it can't be imported at the top of a file that also runs during Next's
// server-side render -- guarded with a dynamic `import()` inside a
// `useEffect` in MathFieldInput below instead of a static import here.
type MathfieldElement = HTMLElement & {
  value: string;
  executeCommand: (command: string | [string, ...unknown[]]) => boolean;
};

// MathLive's own React typings (`mathlive/dist/react.d.ts`) require React 19
// JSX types and don't line up with this project's React 18 setup, so the
// custom element is typed locally instead -- just enough (children, class,
// the one custom attribute used, and the DOM event handlers) to type-check
// the usage in MathFieldInput below.
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

// Preference for which editor a teacher sees by default when opening a math
// node -- Visual (MathLive, click-to-build) or LaTeX (the original raw-text
// input + symbol toolbar). This mirrors the existing a11y-menu pattern
// (`NoteEditor.tsx`'s font size/high-contrast/dyslexia toggles): a reading
// preference, not note content, so it lives in localStorage rather than
// round-tripping through saved markdown.
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

// Quick-insert buttons shown above the LaTeX input while editing a math
// node. `insert` is the literal snippet spliced in at the cursor;
// `caret` is how far from the start of that snippet the cursor should
// land afterward -- for templates like `\frac{}{}` that's *inside* the
// first pair of braces (so the next keystroke fills the numerator, not
// the empty space after the whole snippet), for bare symbols like
// `\pi` it's just the snippet's full length (cursor right after it).
const MATH_SYMBOLS: { label: string; insert: string; caret: number; title: string }[] = [
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
];

// Visual equation editor: a MathLive <math-field> bound to the same `draft`
// string LaTeXInput uses. MathLive typesets live as you type/click -- a
// fraction shows as an actual bar with numerator/denominator boxes you tab
// or arrow between, not `\frac{}{}` source text -- and exposes the result
// as a plain LaTeX string via `.value`, so it drops into the exact same
// `draft`/`updateAttributes({ latex })` flow the LaTeX-input mode already
// uses. No changes needed to storage, markdown serialize/parse, or the
// KaTeX-rendered (non-editing) display state below -- this only replaces
// what's shown *while* `editing` is true.
export type MathFieldHandle = {
  // Inserts a LaTeX snippet at the field's current cursor/selection using
  // MathLive's own "insert" command -- unlike the plain-text-input version
  // in LATEX_SYMBOLS' caller, this lets MathLive place the cursor inside
  // the inserted structure itself (e.g. straight into a fraction's
  // numerator box) rather than needing a hand-computed caret offset.
  insert: (latex: string) => void;
  focus: () => void;
};

const MathFieldInput = forwardRef<
  MathFieldHandle,
  {
    draft: string;
    setDraft: (v: string) => void;
    displayMode: boolean;
    onCommit: (latex: string) => void;
    onCancel: () => void;
    autoFocusToken: string;
  }
>(function MathFieldInput(
  { draft, setDraft, displayMode, onCommit, onCancel, autoFocusToken },
  forwardedRef
) {
  const fieldRef = useRef<MathfieldElement | null>(null);
  const [ready, setReady] = useState(false);
  // Enter/Escape already resolve the edit (commit or cancel) and unmount
  // this field via `setEditing(false)`; unmounting a focused custom element
  // can itself fire a `blur` event, which would otherwise call `onCommit` a
  // second time right after `onCancel` already ran, re-saving the draft
  // Escape was meant to discard. Set right before either path unmounts, so
  // the resulting blur is a no-op.
  const resolvedRef = useRef(false);

  useImperativeHandle(forwardedRef, () => ({
    insert: (latex: string) => {
      fieldRef.current?.executeCommand(["insert", latex]);
      fieldRef.current?.focus();
      if (fieldRef.current) setDraft(fieldRef.current.value);
    },
    focus: () => fieldRef.current?.focus(),
  }));

  // MathLive's custom element registration touches `document`, which
  // doesn't exist during Next's server-side render -- load it only once
  // we're definitely in the browser (mirrors the guard comment on the
  // `MathfieldElement` type above).
  useEffect(() => {
    let cancelled = false;
    import("mathlive").then(({ MathfieldElement }) => {
      // MathLive's default fontsDirectory is resolved relative to its own
      // JS chunk, which doesn't line up with Next's webpack output --
      // point it at a copy served from /public instead (see
      // `public/mathlive-fonts`) so the "math fonts could not be loaded"
      // console warning goes away and glyphs render correctly.
      MathfieldElement.fontsDirectory = "/mathlive-fonts";
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready || !fieldRef.current) return;
    // Keep the field's internal value in sync if `draft` changes from
    // outside this component (e.g. a symbol-toolbar click while in visual
    // mode, or switching back from LaTeX mode with edited text) without
    // fighting the user's own typing -- only push when they actually differ.
    if (fieldRef.current.value !== draft) {
      fieldRef.current.value = draft;
    }
  }, [ready, draft]);

  // Autofocus once, when this input first mounts (switching into visual
  // mode, or opening a fresh node) -- `autoFocusToken` changes only on those
  // transitions, not on every keystroke, so this doesn't refocus mid-edit.
  useEffect(() => {
    if (ready) fieldRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, autoFocusToken]);

  if (!ready) {
    // Same-shape placeholder so layout doesn't jump once MathLive finishes
    // loading; real content swaps in via the effect above.
    return (
      <div className="w-full min-w-[16rem] rounded border border-rule px-2 py-1.5 text-sm text-ink-soft">
        Loading equation editor…
      </div>
    );
  }

  return (
    <math-field
      ref={fieldRef}
      className="w-full min-w-[16rem] rounded border border-rule px-2 py-1.5 text-base outline-none focus:border-marigold"
      // MathLive ships its own virtual keyboard for touch devices; teachers
      // are on laptops/desktops for note-writing, and an unrequested
      // on-screen keyboard popping up mid-note would be more disruptive
      // than helpful, so it's suppressed here.
      math-virtual-keyboard-policy="manual"
      onInput={(e: React.FormEvent<MathfieldElement>) => setDraft(e.currentTarget.value)}
      onBlur={(e: React.FocusEvent<MathfieldElement>) => {
        if (resolvedRef.current) return;
        onCommit(e.currentTarget.value ?? draft);
      }}
      onKeyDown={(e: React.KeyboardEvent) => {
        // Enter both commits *and* is MathLive's own "move to next slot"
        // key inside nested structures (e.g. numerator -> denominator) --
        // only treat it as commit when nothing is left to navigate into,
        // i.e. the field's own default handling didn't already consume it.
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          resolvedRef.current = true;
          onCommit(fieldRef.current?.value ?? draft);
        }
        if (e.key === "Escape") {
          e.preventDefault();
          resolvedRef.current = true;
          onCancel();
        }
      }}
    >
      {draft}
    </math-field>
  );
});

function makeMathView(displayMode: boolean) {
  return function MathView({
    node,
    updateAttributes,
    editor,
  }: {
    node: any;
    updateAttributes: (attrs: any) => void;
    editor: any;
  }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(node.attrs.latex ?? "");
    const [mode, setMode] = useState<MathEditMode>("visual");
    const inputRef = useRef<HTMLInputElement>(null);
    const mathFieldRef = useRef<MathFieldHandle>(null);
    const popupRef = useRef<HTMLDivElement>(null);

    // Load the stored mode preference once we're in the browser (matches
    // the a11y-menu localStorage pattern) rather than defaulting every node
    // to "visual" and then flashing to "latex" a moment later for someone
    // who prefers the raw-text mode.
    useEffect(() => {
      setMode(getStoredMathMode());
    }, []);

    function switchMode(next: MathEditMode) {
      setMode(next);
      setStoredMathMode(next);
    }

    // Inline math's popup floats out of the text flow (absolute-positioned,
    // see comment below), which means it can render past the editor's own
    // right/bottom edge -- e.g. an equation near a table's right edge would
    // otherwise overlap the sidebar instead of staying inside the note.
    // Re-clamp on every keystroke since the popup's width/height changes as
    // the LaTeX preview grows or shrinks.
    useLayoutEffect(() => {
      if (editing && !displayMode && popupRef.current) {
        clampPopoverToEditor(popupRef.current, editor?.view?.dom ?? null);
      }
    }, [editing, draft, editor]);
    // Only block-level math ($$...$$) gets a drag handle -- same
    // reasoning as Section/Callout/ResourceChip (native PM node
    // dragging via `draggable: true` + arm-on-mousedown, reset on
    // mouseup/dragend so a plain click doesn't leave it stuck
    // draggable). Inline math sits mid-sentence like a word; there's
    // no analogous "reorder this token" gesture for it the way there
    // is for a whole equation block, so it's left out.
    const [dragArmed, setDragArmed] = useState(false);

    // Splices a symbol snippet in at the input's current cursor/selection
    // (replacing any selected text), then re-lands the cursor inside the
    // snippet per that symbol's `caret` offset. Runs the reposition on
    // the next frame because `setDraft` re-renders the input with new
    // text first -- setting selectionRange before that commit would be
    // clobbered by React re-applying the (still-stale-looking) value.
    // Only used in LaTeX mode -- visual mode has its own insert path below,
    // since MathLive computes its own post-insert cursor position rather
    // than needing a hand-tracked character offset.
    function insertSymbolLatex(insert: string, caret: number) {
      const el = inputRef.current;
      const start = el?.selectionStart ?? draft.length;
      const end = el?.selectionEnd ?? draft.length;
      const next = draft.slice(0, start) + insert + draft.slice(end);
      setDraft(next);
      const cursor = start + caret;
      requestAnimationFrame(() => {
        el?.focus();
        el?.setSelectionRange(cursor, cursor);
      });
    }

    // Shared by both modes' symbol toolbar: routes the insert to whichever
    // editor is currently showing.
    function insertSymbol(insert: string, caret: number) {
      if (mode === "visual") {
        mathFieldRef.current?.insert(insert);
      } else {
        insertSymbolLatex(insert, caret);
      }
    }

    if (editing) {
      // Always render this wrapper as a div, even for inline math: its child
      // is a bordered block containing the toolbar/input/preview, and a
      // <div> can't legally nest inside the <span> we'd otherwise use for
      // inline mode. Browsers "fix" that invalid nesting by closing the
      // span early and hoisting the div out, which happens outside React's
      // reconciliation and is what made the inline toolbar unreliable.
      //
      // Inline math additionally floats its popup out of the text flow
      // (absolute, anchored below the equation) instead of rendering
      // in-place like block math does. In-flow was the earlier behavior,
      // but for a token sitting mid-sentence that meant the popup's width
      // fought with surrounding text -- it could get squeezed onto its own
      // wrapped line, or shove the rest of the paragraph down while open.
      // Floating it keeps the paragraph's layout stable and gives the
      // toolbar/input/preview a fixed, predictable width to render at.
      return (
        <NodeViewWrapper
          as="div"
          className={
            displayMode ? "inline-block align-middle" : "relative inline-block align-middle"
          }
          contentEditable={false}
          // See resource-node.tsx's MermaidNodeView for the full
          // explanation: this atom has no contentDOM ProseMirror
          // expects to be interactive, so without this, a click
          // anywhere in here (the LaTeX input included) would bubble to
          // PM's own view-level click handling, which resolves it to
          // "click on this atom" and sets a NodeSelection over the
          // whole node -- painting the selected-node highlight and
          // potentially knocking this back out of its editing render.
          onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
          // The more serious half: `contentEditable={false}` doesn't
          // stop DOM event bubbling, so typing in the LaTeX input still
          // reaches PM's own view-level key handler. If PM's selection
          // is still resting on this atom, it can treat a keystroke as
          // "replace the current selection" -- deleting the whole
          // equation node from the real document and replacing it with
          // one character of plain text. Fires after the input's own
          // Enter/Escape onKeyDown below (bubble phase runs child
          // first), so it doesn't interfere with those.
          onKeyDown={(e: React.KeyboardEvent) => e.stopPropagation()}
          onKeyUp={(e: React.KeyboardEvent) => e.stopPropagation()}
        >
          {!displayMode && (
            <span
              className="rounded bg-marigold/20 px-1 font-mono text-sm text-ink"
              contentEditable={false}
            >
              {draft.trim() ? "∑" : "$…$"}
            </span>
          )}
          <div
            ref={popupRef}
            className={
              displayMode
                ? "rounded-md border border-marigold bg-white p-2 shadow-sm"
                : "absolute left-0 top-full z-20 mt-1 w-max max-w-[24rem] rounded-md border border-marigold bg-white p-2 shadow-lg"
            }
          >
            <div className="mb-1.5 flex items-center justify-between gap-2" contentEditable={false}>
              <div className="flex flex-wrap gap-0.5">
                {MATH_SYMBOLS.map((sym) => (
                  <button
                    key={sym.label}
                    type="button"
                    title={sym.title}
                    // Keep focus on the active editor instead of the button
                    // -- a normal click blurs the input/math-field first,
                    // which for LaTeX mode would fire onBlur and close
                    // editing before the click handler ever ran.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insertSymbol(sym.insert, sym.caret)}
                    className="min-w-[1.75rem] rounded px-1 py-0.5 font-serif text-sm text-ink hover:bg-paper"
                  >
                    {sym.label}
                  </button>
                ))}
              </div>
              {/* Visual/LaTeX toggle -- visual is the default click-to-build
                  equation editor (#19's remaining gap); LaTeX stays as the
                  power-user fallback for anyone who'd rather type source
                  directly. Choice persists per-browser via localStorage,
                  same pattern as the Aa accessibility menu. */}
              <div className="flex shrink-0 rounded border border-rule text-xs">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => switchMode("visual")}
                  aria-pressed={mode === "visual"}
                  className={`rounded-l px-1.5 py-0.5 ${
                    mode === "visual" ? "bg-marigold/30 text-ink" : "text-ink-soft hover:bg-paper"
                  }`}
                >
                  Visual
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => switchMode("latex")}
                  aria-pressed={mode === "latex"}
                  className={`rounded-r border-l border-rule px-1.5 py-0.5 ${
                    mode === "latex" ? "bg-marigold/30 text-ink" : "text-ink-soft hover:bg-paper"
                  }`}
                >
                  LaTeX
                </button>
              </div>
            </div>
            {mode === "visual" ? (
              <MathFieldInput
                ref={mathFieldRef}
                draft={draft}
                setDraft={setDraft}
                displayMode={displayMode}
                autoFocusToken={mode}
                onCommit={(latex) => {
                  updateAttributes({ latex });
                  setEditing(false);
                }}
                onCancel={() => {
                  setDraft(node.attrs.latex ?? "");
                  setEditing(false);
                }}
              />
            ) : (
              <input
                ref={inputRef}
                autoFocus
                onMouseDownCapture={(e) => e.stopPropagation()}
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
                className="w-full min-w-[16rem] rounded border border-rule px-2 py-1 font-mono text-sm outline-none focus:border-marigold"
                placeholder={
                  displayMode ? "\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}" : "x^2 + 3x - 4 = 0"
                }
              />
            )}
            {mode === "latex" && draft.trim() && (
              <div
                className="mt-1.5 border-t border-rule pt-1.5 text-sm"
                dangerouslySetInnerHTML={{ __html: renderKatex(draft, displayMode) }}
              />
            )}
          </div>
        </NodeViewWrapper>
      );
    }

    if (!displayMode) {
      const isEmpty = !node.attrs.latex?.trim();
      if (isEmpty) {
        return (
          <NodeViewWrapper
            as="span"
            className="cursor-pointer rounded bg-marigold/20 px-1 font-mono text-sm text-ink-soft hover:bg-marigold/30"
            onClick={() => setEditing(true)}
            contentEditable={false}
          >
            $…$
          </NodeViewWrapper>
        );
      }
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
          title="Drag to reorder (or click inside and press Alt+Up/Down)"
          aria-label="Drag to reorder this math block, or click inside it and press Alt+Up or Alt+Down"
          data-drag-handle
          className="absolute -left-6 top-2 hidden h-6 w-6 cursor-grab select-none items-center justify-center rounded text-ink-soft hover:bg-paper active:cursor-grabbing group-hover:flex"
        >
          ⠿
        </button>
        {node.attrs.latex?.trim() ? (
          <div
            onClick={() => setEditing(true)}
            contentEditable={false}
            className="cursor-pointer"
            dangerouslySetInnerHTML={{ __html: renderKatex(node.attrs.latex, displayMode) }}
          />
        ) : (
          <div
            onClick={() => setEditing(true)}
            contentEditable={false}
            className="cursor-pointer rounded bg-marigold/20 px-2 py-1 font-mono text-sm text-ink-soft"
          >
            $$…$$
          </div>
        )}
      </NodeViewWrapper>
    );
  };
}

function defineMathNode(name: "mathInline" | "mathBlock", displayMode: boolean) {
  return Node.create({
    name,
    group: displayMode ? "block" : "inline",
    inline: !displayMode,
    atom: true,
    draggable: displayMode,

    addAttributes() {
      return { latex: { default: "" } };
    },

    parseHTML() {
      // The rendered markdown puts the LaTeX source as the element's
      // *text content* (`<span data-math="mathInline">x^2+1</span>`),
      // not as an attribute -- without this `getAttrs`, ProseMirror
      // matches the tag but has no rule telling it where `latex` comes
      // from, so it silently falls back to the attribute's default
      // (""), and every equation loaded from saved markdown renders as
      // a blank placeholder instead of the real formula.
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
      // Same fix as ResourceChip (see resource-node.tsx): without this,
      // clicking to edit the equation makes ProseMirror establish its
      // own NodeSelection over this atom node before our onClick runs,
      // which can crash BubbleMenu's live position tracking when the
      // node view swaps between rendered/editing state.
      //
      // For mathBlock (displayMode), same carve-out as ResourceChip's
      // stopEvent needed once it became `draggable: true`: a blanket
      // `() => true` tells ProseMirror's native node-dragging machinery
      // to stand down for drag/drop events too, which silently disables
      // the drag it needs to perform. mathInline isn't draggable, so it
      // keeps the simple blanket version.
      return ReactNodeViewRenderer(makeMathView(displayMode), {
        stopEvent: displayMode ? dragAwareStopEvent : () => true,
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
