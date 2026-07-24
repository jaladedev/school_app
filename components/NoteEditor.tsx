"use client";

import { useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { saveTopicNote } from "@/lib/actions/teacher";
import { emitToast } from "@/lib/toast";

export function NoteEditor({
  topicId,
  initialContent,
  initialStatus,
}: {
  topicId: string;
  initialContent: string;
  initialStatus: "draft" | "published" | "archived" | "unwritten";
}) {
  const [content, setContent] = useState(initialContent);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-ink-soft">Currently: {initialStatus}</p>
        <div className="flex gap-2">
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-soft">Markdown</p>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={24}
            className="w-full rounded-lg border border-rule bg-white p-3 font-mono text-sm text-ink outline-none focus-visible:border-marigold"
            placeholder="## Introduction&#10;Write the topic explanation here. Use markdown tables for summaries."
          />
        </div>
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-soft">Preview</p>
          <div className="topic-prose h-[calc(24*1.5rem)] overflow-y-auto rounded-lg border border-rule bg-white p-4">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs text-ink-soft">
        Diagrams and other resources (images, Mermaid diagrams, videos) are attached separately
        after publishing — this editor covers the written note and tables.
      </p>
      {error && <p className="mt-2 text-sm text-clay">{error}</p>}
    </div>
  );
}
