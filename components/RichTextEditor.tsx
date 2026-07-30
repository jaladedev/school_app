"use client";

import { useEffect, useRef } from "react";

const TOOLBAR_BUTTONS: { command: string; label: string; ariaLabel: string }[] = [
  { command: "bold", label: "B", ariaLabel: "Bold" },
  { command: "italic", label: "I", ariaLabel: "Italic" },
  { command: "underline", label: "U", ariaLabel: "Underline" },
  { command: "insertUnorderedList", label: "•", ariaLabel: "Bulleted list" },
  { command: "insertOrderedList", label: "1.", ariaLabel: "Numbered list" },
];

/**
 * Minimal WYSIWYG editor built on contentEditable + document.execCommand.
 * Deliberately not a full library (Tiptap/Quill/etc.) -- the bulk-email
 * composer only needs bold/italic/underline/lists/links, and pulling in a
 * whole editor framework for that is more surface area than this one form
 * needs. Emits raw HTML via onChange; the server sanitizes before sending
 * (see sanitizeEmailHtml in lib/actions/bulkEmail.ts) since a contentEditable
 * div's innerHTML shouldn't be trusted as-is even from an admin-only form.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  // Tracks whether the last change came from typing in this editor (skip
  // the sync-back effect) vs. from outside (e.g. the parent clearing the
  // field after send) -- without this, every keystroke's onChange -> value
  // update -> effect loop would reset the cursor to the start.
  const isInternalChange = useRef(false);

  useEffect(() => {
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  function handleInput() {
    isInternalChange.current = true;
    onChange(editorRef.current?.innerHTML ?? "");
  }

  function runCommand(command: string) {
    editorRef.current?.focus();
    document.execCommand(command, false);
    handleInput();
  }

  function handleLinkClick() {
    const url = window.prompt("Link URL (include https://)");
    if (!url) return;
    editorRef.current?.focus();
    document.execCommand("createLink", false, url);
    handleInput();
  }

  const isEmpty = value.trim() === "" || value.trim() === "<br>";

  return (
    <div className="rounded-lg border border-rule">
      <div className="flex flex-wrap gap-1 border-b border-rule bg-paper px-2 py-1.5">
        {TOOLBAR_BUTTONS.map((btn) => (
          <button
            key={btn.command}
            type="button"
            aria-label={btn.ariaLabel}
            onMouseDown={(e) => e.preventDefault()} // keep focus/selection in the editor
            onClick={() => runCommand(btn.command)}
            className="min-w-[28px] rounded px-2 py-1 text-sm font-medium text-ink-soft hover:bg-white hover:text-ink"
          >
            {btn.label}
          </button>
        ))}
        <button
          type="button"
          aria-label="Insert link"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleLinkClick}
          className="min-w-[28px] rounded px-2 py-1 text-sm font-medium text-ink-soft hover:bg-white hover:text-ink"
        >
          🔗
        </button>
      </div>
      <div className="relative">
        {isEmpty && placeholder && (
          <p className="pointer-events-none absolute left-3 top-2 text-sm text-ink-soft">
            {placeholder}
          </p>
        )}
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          className="min-h-[160px] w-full px-3 py-2 text-sm text-ink focus:outline-none [&_a]:text-leaf [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
          suppressContentEditableWarning
        />
      </div>
    </div>
  );
}
