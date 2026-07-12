"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createLesson } from "@/lib/actions/teacher";

export function CreateLessonForm({
  timetableEntryId,
  classId,
  topics,
  onClose,
}: {
  timetableEntryId: string;
  classId: string;
  topics: { id: string; title: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [topicId, setTopicId] = useState("");
  const [objectives, setObjectives] = useState("");
  const [homework, setHomework] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        await createLesson({
          timetableEntryId,
          classId,
          lessonDate: new Date().toISOString().slice(0, 10),
          topicId: topicId || undefined,
          objectives: objectives || undefined,
          homework: homework || undefined,
        });
        onClose();
        router.refresh();
      } catch (err: any) {
        setError(err.message ?? "Something went wrong.");
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-2 space-y-2 rounded-lg border border-rule bg-paper p-3"
    >
      <select
        value={topicId}
        onChange={(e) => setTopicId(e.target.value)}
        className="w-full rounded-lg border border-rule px-3 py-2 text-sm"
      >
        <option value="">No specific curriculum topic</option>
        {topics.map((t) => (
          <option key={t.id} value={t.id}>
            {t.title}
          </option>
        ))}
      </select>

      <textarea
        placeholder="Lesson objectives (optional)"
        value={objectives}
        onChange={(e) => setObjectives(e.target.value)}
        rows={2}
        className="w-full rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
      />

      <textarea
        placeholder="Homework given (optional)"
        value={homework}
        onChange={(e) => setHomework(e.target.value)}
        rows={2}
        className="w-full rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
      />

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-leaf px-3 py-1.5 text-sm font-medium text-white hover:bg-leaf/90 disabled:opacity-60"
        >
          {isPending ? "Logging…" : "Log lesson"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-rule px-3 py-1.5 text-sm text-ink-soft"
        >
          Cancel
        </button>
      </div>

      {error && <p className="text-sm text-clay">{error}</p>}
    </form>
  );
}