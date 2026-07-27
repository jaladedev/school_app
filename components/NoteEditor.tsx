"use client";

import { useRef, useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { saveTopicNote, createMermaidResource } from "@/lib/actions/teacher";
import { emitToast } from "@/lib/toast";
import { MermaidDiagram } from "@/components/MermaidDiagram";
import type { TopicResource } from "@/types/database";

const RESOURCE_TYPE_LABEL: Record<TopicResource["resource_type"], string> = {
  image: "Image",
  diagram_mermaid: "Diagram",
  video: "Video",
  pdf: "PDF",
  link: "Link",
  audio: "Audio",
};

const DEFAULT_MERMAID = "flowchart TD\n  A[Start] --> B[End]";

type ToolbarAction =
  | { kind: "wrap"; before: string; after: string; placeholder: string }
  | { kind: "linePrefix"; prefix: string }
  | { kind: "insert"; text: string };

const TOOLBAR_BUTTONS: { label: string; title: string; action: ToolbarAction }[] = [
  {
    label: "B",
    title: "Bold",
    action: { kind: "wrap", before: "**", after: "**", placeholder: "bold text" },
  },
  {
    label: "I",
    title: "Italic",
    action: { kind: "wrap", before: "_", after: "_", placeholder: "italic text" },
  },
  {
    label: "H",
    title: "Heading",
    action: { kind: "linePrefix", prefix: "## " },
  },
  {
    label: "∑",
    title: "Inline math (LaTeX) — e.g. \\frac{a}{b}, x^2, \\sqrt{n}",
    action: { kind: "wrap", before: "$", after: "$", placeholder: "x^2 + 3x - 4 = 0" },
  },
  {
    label: "∑∑",
    title: "Block math (LaTeX, own line) — for a full worked step or equation",
    action: {
      kind: "wrap",
      before: "\n$$\n",
      after: "\n$$\n",
      placeholder: "\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}",
    },
  },
  {
    label: "Table",
    title: "Insert table",
    action: {
      kind: "insert",
      text: "| Column 1 | Column 2 |\n| --- | --- |\n| Cell | Cell |\n",
    },
  },
];

export function NoteEditor({
  topicId,
  noteId,
  initialContent,
  initialStatus,
  resources = [],
}: {
  topicId: string;
  noteId?: string;
  initialContent: string;
  initialStatus: "draft" | "published" | "archived" | "unwritten";
  resources?: TopicResource[];
}) {
  const [content, setContent] = useState(initialContent);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [diagramPanelOpen, setDiagramPanelOpen] = useState(false);
  const [diagramTitle, setDiagramTitle] = useState("");
  const [diagramCode, setDiagramCode] = useState(DEFAULT_MERMAID);
  const [isSavingDiagram, setIsSavingDiagram] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  function handleSave(status: "draft" | "published") {
    setError(null);
    startTransition(async () => {
      try {
        await saveTopicNote(topicId, content, status);
        emitToast(status === "published" ? "Topic note published." : "Draft saved.");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unable to save the topic note.";
        setError(message);
        emitToast(message, "error");
      }
    });
  }

  // Replaces the current selection (or inserts at the cursor if nothing is
  // selected) and restores focus with the cursor placed sensibly afterward,
  // so toolbar actions feel like a normal text editor rather than always
  // appending to the end of the note.
  function replaceSelection(
    build: (
      selected: string,
      before: string,
      after: string
    ) => {
      text: string;
      cursorStart: number;
      cursorEnd: number;
    }
  ) {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? content.length;
    const end = el?.selectionEnd ?? content.length;
    const before = content.slice(0, start);
    const after = content.slice(end);
    const selected = content.slice(start, end);

    const { text, cursorStart, cursorEnd } = build(selected, before, after);
    const nextContent = `${before}${text}${after}`;
    setContent(nextContent);

    const absoluteStart = before.length + cursorStart;
    const absoluteEnd = before.length + cursorEnd;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(absoluteStart, absoluteEnd);
    });
  }

  function runToolbarAction(action: ToolbarAction) {
    if (action.kind === "wrap") {
      const { before, after, placeholder } = action;
      replaceSelection((selected) => {
        const inner = selected || placeholder;
        return {
          text: `${before}${inner}${after}`,
          cursorStart: before.length,
          cursorEnd: before.length + inner.length,
        };
      });
      return;
    }

    if (action.kind === "linePrefix") {
      const el = textareaRef.current;
      const start = el?.selectionStart ?? content.length;
      const lineStart = content.lastIndexOf("\n", start - 1) + 1;
      const alreadyPrefixed =
        content.slice(lineStart, lineStart + action.prefix.length) === action.prefix;

      const before = content.slice(0, lineStart);
      const restOfLineAndAfter = content.slice(lineStart);
      const nextContent = alreadyPrefixed
        ? `${before}${restOfLineAndAfter.slice(action.prefix.length)}`
        : `${before}${action.prefix}${restOfLineAndAfter}`;

      setContent(nextContent);
      const delta = alreadyPrefixed ? -action.prefix.length : action.prefix.length;
      const cursorPos = Math.max(lineStart, start + delta);
      requestAnimationFrame(() => {
        el?.focus();
        el?.setSelectionRange(cursorPos, cursorPos);
      });
      return;
    }

    // action.kind === "insert"
    replaceSelection((_selected, before) => {
      const needsLeadingNewline = before.length > 0 && !before.endsWith("\n");
      const text = `${needsLeadingNewline ? "\n" : ""}${action.text}`;
      return { text, cursorStart: text.length, cursorEnd: text.length };
    });
  }

  // Inserts a [[resource:ID]] marker at the current cursor position (or
  // replaces the current selection), then puts the cursor right after the
  // inserted marker so a teacher can keep typing without hunting for it.
  function insertResourceMarker(resource: TopicResource) {
    const marker = `[[resource:${resource.id}]]`;
    replaceSelection((_selected, before, after) => {
      const needsLeadingNewline = before.length > 0 && !before.endsWith("\n");
      const needsTrailingNewline = after.length > 0 && !after.startsWith("\n");
      const text = `${needsLeadingNewline ? "\n" : ""}${marker}${needsTrailingNewline ? "\n" : ""}`;
      return { text, cursorStart: text.length, cursorEnd: text.length };
    });
  }

  function handlePickResource(resource: TopicResource) {
    insertResourceMarker(resource);
    setPickerOpen(false);
  }

  async function handleSaveDiagram() {
    if (!noteId) return;
    if (!diagramCode.trim()) {
      emitToast("Write some Mermaid code before saving.", "error");
      return;
    }

    setIsSavingDiagram(true);
    try {
      const resource = await createMermaidResource(
        topicId,
        noteId,
        diagramTitle || "Diagram",
        diagramCode
      );
      insertResourceMarker(resource);
      emitToast("Diagram added to the note.");
      setDiagramPanelOpen(false);
      setDiagramTitle("");
      setDiagramCode(DEFAULT_MERMAID);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unable to save the diagram.";
      emitToast(message, "error");
    } finally {
      setIsSavingDiagram(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-wide text-ink-soft">Currently: {initialStatus}</p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setPickerOpen((open) => !open)}
              disabled={isPending || resources.length === 0}
              className="rounded-lg border border-rule px-3 py-1.5 text-sm text-ink hover:bg-paper disabled:opacity-60"
              title={resources.length === 0 ? "No resources attached to this topic yet" : undefined}
            >
              Insert resource
            </button>

            {pickerOpen && resources.length > 0 && (
              <div className="absolute right-0 z-10 mt-1 max-h-64 w-64 overflow-y-auto rounded-lg border border-rule bg-white py-1 shadow-lg">
                {resources.map((resource) => (
                  <button
                    key={resource.id}
                    type="button"
                    onClick={() => handlePickResource(resource)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-paper"
                  >
                    <span className="truncate">{resource.title ?? "Untitled resource"}</span>
                    <span className="shrink-0 text-xs uppercase tracking-wide text-ink-soft">
                      {RESOURCE_TYPE_LABEL[resource.resource_type]}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setDiagramPanelOpen((open) => !open)}
            disabled={isPending || !noteId}
            className="rounded-lg border border-rule px-3 py-1.5 text-sm text-ink hover:bg-paper disabled:opacity-60"
            title={!noteId ? "Save the note once before generating a diagram" : undefined}
          >
            Generate Mermaid diagram
          </button>

          <button
            onClick={() => handleSave("draft")}
            disabled={isPending}
            className="rounded-lg border border-rule px-3 py-1.5 text-sm text-ink hover:bg-paper disabled:opacity-60"
          >
            Save draft
          </button>
          <button
            onClick={() => handleSave("published")}
            disabled={isPending}
            className="rounded-lg bg-marigold px-3 py-1.5 text-sm font-medium text-ink hover:bg-marigold-dark disabled:opacity-60"
          >
            Publish
          </button>
        </div>
      </div>

      {diagramPanelOpen && noteId && (
        <section className="mb-4 rounded-xl border border-rule bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold text-ink">
              Generate Mermaid diagram
            </h3>
            <button
              type="button"
              onClick={() => setDiagramPanelOpen(false)}
              className="text-xs text-ink-soft hover:underline"
            >
              Close
            </button>
          </div>
          <input
            type="text"
            value={diagramTitle}
            onChange={(e) => setDiagramTitle(e.target.value)}
            placeholder="Diagram title (optional)"
            className="mb-2 w-full rounded-lg border border-rule bg-white p-2 text-sm text-ink outline-none focus-visible:border-marigold"
          />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-soft">
                Mermaid code
              </p>
              <textarea
                value={diagramCode}
                onChange={(e) => setDiagramCode(e.target.value)}
                rows={10}
                className="w-full rounded-lg border border-rule bg-white p-3 font-mono text-sm text-ink outline-none focus-visible:border-marigold"
              />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-soft">
                Preview
              </p>
              <div className="h-full min-h-[10rem] rounded-lg border border-rule bg-paper p-2">
                <MermaidDiagram code={diagramCode} title={diagramTitle || undefined} />
              </div>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={handleSaveDiagram}
              disabled={isSavingDiagram}
              className="rounded-lg bg-marigold px-3 py-1.5 text-sm font-medium text-ink hover:bg-marigold-dark disabled:opacity-60"
            >
              {isSavingDiagram ? "Saving…" : "Insert diagram into note"}
            </button>
          </div>
        </section>
      )}

      <div className="mb-2 flex items-center gap-1 rounded-lg border border-rule bg-paper p-1">
        {TOOLBAR_BUTTONS.map((button) => (
          <button
            key={button.label}
            type="button"
            title={button.title}
            onClick={() => runToolbarAction(button.action)}
            className="min-w-[2rem] rounded-md px-2 py-1 text-sm font-semibold text-ink hover:bg-white"
          >
            {button.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-soft">Markdown</p>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={24}
            className="w-full rounded-lg border border-rule bg-white p-3 font-mono text-sm text-ink outline-none focus-visible:border-marigold"
            placeholder="## Introduction&#10;Write the topic explanation here. Use markdown tables for summaries, and $...$ or $$...$$ for math."
          />
        </div>
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-soft">Preview</p>
          <div className="topic-prose h-[calc(24*1.5rem)] overflow-y-auto rounded-lg border border-rule bg-white p-4">
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
              {content}
            </ReactMarkdown>
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs text-ink-soft">
        Images, videos, and other uploaded resources are attached separately after publishing — use
        &quot;Insert resource&quot; to place one at a specific point in the text, or &quot;Generate
        Mermaid diagram&quot; to create and insert a new diagram directly. For calculations and
        formulas, wrap LaTeX in single $ for inline math (e.g. $x^2$) or double $$ on its own line
        for a full equation or worked step — use the ∑ / ∑∑ buttons to insert either.
      </p>
      {error && <p className="mt-2 text-sm text-clay">{error}</p>}
    </div>
  );
}
