"use client";

import { useEffect, useRef, useState } from "react";
import katex from "katex";

// Same MathLive custom element already registered/typed for the note
// editor's math node (lib/tiptap/math-nodes.tsx). Declared again here
// since this component is intentionally standalone -- QuizBuilder's
// question_text is a plain markdown string (not a tiptap doc), so it
// can't reuse that node's ProseMirror-specific NodeView, only the same
// underlying <math-field> element and font asset pipeline.
type MathfieldElement = HTMLElement & {
  value: string;
  executeCommand: (command: string | [string, ...unknown[]]) => boolean;
  placeholderSymbol: string;
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

type MathEditMode = "visual" | "latex";

const QUICK_SYMBOLS: { label: string; insert: string; mathliveInsert?: string; title: string }[] = [
  { label: "x²", insert: "^{}", mathliveInsert: "^{\\placeholder{}}", title: "Superscript" },
  { label: "x₂", insert: "_{}", mathliveInsert: "_{\\placeholder{}}", title: "Subscript" },
  {
    label: "√",
    insert: "\\sqrt{}",
    mathliveInsert: "\\sqrt{\\placeholder{}}",
    title: "Square root",
  },
  {
    label: "a/b",
    insert: "\\frac{}{}",
    mathliveInsert: "\\frac{\\placeholder{}}{\\placeholder{}}",
    title: "Fraction",
  },
  {
    label: "∑",
    insert: "\\sum_{}^{}",
    mathliveInsert: "\\sum_{\\placeholder{}}^{\\placeholder{}}",
    title: "Summation",
  },
  { label: "π", insert: "\\pi", title: "Pi" },
  { label: "θ", insert: "\\theta", title: "Theta" },
  { label: "±", insert: "\\pm", title: "Plus-minus" },
  { label: "×", insert: "\\times", title: "Times" },
  { label: "÷", insert: "\\div", title: "Divide" },
  { label: "≤", insert: "\\leq", title: "Less than or equal" },
  { label: "≥", insert: "\\geq", title: "Greater than or equal" },
  { label: "≠", insert: "\\neq", title: "Not equal" },
];

function renderKatex(latex: string, displayMode: boolean) {
  try {
    return katex.renderToString(latex, { displayMode, throwOnError: false });
  } catch {
    return `<span class="text-clay">Invalid LaTeX</span>`;
  }
}

/**
 * Visual (MathLive) / LaTeX-source equation field. Kept separate from
 * the popover shell below so mathlive is only lazy-loaded once the user
 * actually opens an editor, not on every QuizBuilder page load.
 */
function MathField({
  mode,
  value,
  onChange,
  onCommit,
  onCancel,
}: {
  mode: MathEditMode;
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  const fieldRef = useRef<MathfieldElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (mode !== "visual") return;
    let cancelled = false;
    import("mathlive").then(({ MathfieldElement }) => {
      MathfieldElement.fontsDirectory = "/mathlive-fonts";
      return customElements.whenDefined("math-field").then(() => {
        if (!cancelled) setReady(true);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  useEffect(() => {
    if (mode !== "visual" || !ready || !fieldRef.current) return;
    if (fieldRef.current.value !== value) fieldRef.current.value = value;
    fieldRef.current.placeholderSymbol = "\u25A1";
    requestAnimationFrame(() => {
      try {
        fieldRef.current?.focus();
      } catch {}
    });
  }, [mode, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mode === "latex") requestAnimationFrame(() => inputRef.current?.focus());
  }, [mode]);

  // Stop Shadow DOM events from mathlive escaping and being swallowed by
  // ancestor handlers (e.g. a dialog's own outside-click / Escape logic).
  useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    const stop = (e: Event) => e.stopPropagation();
    const events = ["mousedown", "mouseup", "click", "keydown", "keyup"];
    events.forEach((ev) => el.addEventListener(ev, stop, true));
    return () => events.forEach((ev) => el.removeEventListener(ev, stop, true));
  }, [ready]);

  function insertAtCaret(text: string) {
    const el = inputRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + text + value.slice(end);
    onChange(next);
    const cursor = start + text.length;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap gap-0.5">
        {QUICK_SYMBOLS.map((sym) => (
          <button
            key={sym.label}
            type="button"
            title={sym.title}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() =>
              mode === "visual"
                ? fieldRef.current?.executeCommand(["insert", sym.mathliveInsert ?? sym.insert])
                : insertAtCaret(sym.insert)
            }
            className="min-w-[1.75rem] rounded px-1 py-0.5 font-serif text-sm text-ink hover:bg-paper"
          >
            {sym.label}
          </button>
        ))}
      </div>

      {mode === "visual" ? (
        ready ? (
          <math-field
            ref={fieldRef as any}
            className="min-w- w-full rounded border border-rule px-2 py-1.5 text-base outline-none focus:border-marigold"
            math-virtual-keyboard-policy="manual"
            onInput={(e: React.FormEvent<MathfieldElement>) =>
              onChange((e.currentTarget as MathfieldElement).value)
            }
            onKeyDown={(e: React.KeyboardEvent) => {
              e.stopPropagation();
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onCommit();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                onCancel();
              }
            }}
          />
        ) : (
          <div className="w-full rounded border border-rule px-2 py-1.5 text-sm text-ink-soft">
            Loading…
          </div>
        )
      ) : (
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              e.preventDefault();
              onCommit();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              onCancel();
            }
          }}
          placeholder="\frac{-b \pm \sqrt{b^2-4ac}}{2a}"
          className="min-w- w-full rounded border border-rule px-2 py-1 font-mono text-sm outline-none focus:border-marigold"
        />
      )}

      {value.trim() && (
        <div
          className="mt-1.5 border-t border-rule pt-1.5 text-sm"
          dangerouslySetInnerHTML={{ __html: renderKatex(value, false) }}
        />
      )}
    </div>
  );
}

/**
 * "∑ Inline math" / "∑ Block math" toolbar buttons for a plain-text
 * markdown field. Opens a popover with the same visual (MathLive) /
 * LaTeX-source editing modes as the note editor's math node, then hands
 * the caller back a ready-to-splice `$...$` or `$$...$$` string --
 * QuestionText (react-markdown + remark-math + rehype-katex) renders
 * either form identically to how QuizAttemptRunner shows it to students.
 */
export function MathInsertButton({
  onInsertAction,
}: {
  onInsertAction: (snippet: string) => void;
}) {
  const [open, setOpen] = useState<"inline" | "block" | null>(null);
  const [mode, setMode] = useState<MathEditMode>("visual");
  const [latex, setLatex] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);

  // `mathVirtualKeyboard` is a runtime global mathlive attaches to
  // `window` (see mathlive's own .d.ts -- it's declared under
  // `declare global { interface Window { ... } }`, not as a module
  // export), so it has to be read off `window` after the import
  // resolves rather than destructured from the import itself.
  function hideVirtualKeyboard() {
    import("mathlive").then(() => window.mathVirtualKeyboard?.hide()).catch(() => {});
  }

  useEffect(() => {
    return () => hideVirtualKeyboard();
  }, []);

  // MathLive's on-screen virtual keyboard is a global singleton appended
  // to document.body -- it lives outside popoverRef/anchorRef entirely,
  // so without this check every tap on it reads as an "outside click"
  // and closes (unmounts) the popover mid-interaction, orphaning the
  // keyboard panel (still visible, but no longer wired to any field --
  // that's why backspace/keys stopped doing anything). Same fix already
  // used by the note editor's math node (lib/tiptap/math-nodes.tsx).
  const isMathliveUi = (n: EventTarget) =>
    n instanceof Element && (n.closest?.('[class*="ML__"]') || n.tagName === "MATH-FIELD");

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const path = e.composedPath?.() ?? [];
      const inside = path.some(
        (n) =>
          n === popoverRef.current ||
          n === anchorRef.current ||
          (n instanceof Element &&
            (popoverRef.current?.contains(n as Node) || anchorRef.current?.contains(n as Node))) ||
          isMathliveUi(n)
      );
      if (!inside) closePopover();
    };
    document.addEventListener("mousedown", onDown, true);
    return () => document.removeEventListener("mousedown", onDown, true);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Explicit safety net for every path that actually should close the
  // popover (commit, cancel, real outside click) -- "manual" keyboard
  // policy means mathlive won't auto-hide it for us, so a closed popover
  // with no field left to type into would otherwise leave the keyboard
  // panel sitting on screen indefinitely.
  function closePopover() {
    setOpen(null);
    setLatex("");
    hideVirtualKeyboard();
  }

  function commit() {
    const trimmed = latex.trim();
    if (trimmed) {
      onInsertAction(open === "block" ? `\n\n$$\n${trimmed}\n$$\n\n` : `$${trimmed}$`);
    }
    closePopover();
  }

  function toggle(kind: "inline" | "block") {
    if (open === kind) {
      closePopover();
    } else {
      setLatex("");
      setOpen(kind);
    }
  }

  return (
    <div ref={anchorRef} className="relative inline-block">
      <div className="flex overflow-hidden rounded-lg border border-rule text-xs">
        <button
          type="button"
          onClick={() => toggle("inline")}
          className={`px-2 py-1.5 font-medium ${open === "inline" ? "bg-marigold/30 text-ink" : "text-ink-soft hover:bg-paper"}`}
          title="Insert inline math, e.g. $x^2$"
        >
          ∑ Inline math
        </button>
        <button
          type="button"
          onClick={() => toggle("block")}
          className={`border-l border-rule px-2 py-1.5 font-medium ${open === "block" ? "bg-marigold/30 text-ink" : "text-ink-soft hover:bg-paper"}`}
          title="Insert a centred block equation, e.g. $$x^2$$"
        >
          ∑ Block math
        </button>
      </div>

      {open && (
        <div
          ref={popoverRef}
          className="absolute left-0 top-full z-50 mt-1 w-80 rounded-md border border-marigold bg-white p-2 shadow-lg"
        >
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-ink-soft">
              {open === "block" ? "Block equation" : "Inline equation"}
            </p>
            <div className="flex shrink-0 rounded border border-rule text-xs">
              <button
                type="button"
                onClick={() => {
                  hideVirtualKeyboard();
                  setMode("visual");
                }}
                className={`rounded-l px-1.5 py-0.5 ${mode === "visual" ? "bg-marigold/30" : "text-ink-soft"}`}
              >
                Visual
              </button>
              <button
                type="button"
                onClick={() => {
                  hideVirtualKeyboard();
                  setMode("latex");
                }}
                className={`rounded-r border-l px-1.5 py-0.5 ${mode === "latex" ? "bg-marigold/30" : "text-ink-soft"}`}
              >
                LaTeX
              </button>
            </div>
          </div>

          <MathField
            mode={mode}
            value={latex}
            onChange={setLatex}
            onCommit={commit}
            onCancel={closePopover}
          />

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={closePopover}
              className="rounded-md px-2 py-1 text-xs text-ink-soft hover:bg-paper"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={commit}
              disabled={!latex.trim()}
              className="rounded-md bg-marigold px-3 py-1 text-xs font-medium text-ink disabled:opacity-40"
            >
              Insert
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
