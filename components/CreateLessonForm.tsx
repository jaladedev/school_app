"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createLesson } from "@/lib/actions/teacher";
import { HomeworkDueDateField } from "@/components/HomeworkDueDateField";
import { localIsoDate } from "@/lib/quizWindow";

const inputClass =
  "w-full rounded-lg border border-rule bg-white px-3 py-2 text-sm outline-none focus-visible:border-marigold";

export function CreateLessonForm({
  timetableEntryId,
  classId,
  topics,
  suggestedTopicId,
  onCloseAction,
}: {
  timetableEntryId: string;
  classId: string;
  topics: { id: string; title: string }[];
  suggestedTopicId?: string | null;
  onCloseAction: () => void;
}) {
  const router = useRouter();
  const [topicId, setTopicId] = useState(suggestedTopicId ?? "");
  const [objectives, setObjectives] = useState("");
  const [homework, setHomework] = useState("");
  const [homeworkDueAt, setHomeworkDueAt] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const today = localIsoDate();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createLesson({
        timetableEntryId,
        classId,
        lessonDate: today,
        topicId: topicId || undefined,
        objectives: objectives || undefined,
        homework: homework.trim() || undefined,
        homeworkDueAt: homework.trim() ? homeworkDueAt || undefined : undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onCloseAction();
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-2 space-y-4 rounded-lg border border-rule bg-paper p-4"
    >
      <div className="space-y-1">
        <label htmlFor={`topic-${timetableEntryId}`} className="text-xs font-medium text-ink">
          Topic
        </label>
        <select
          id={`topic-${timetableEntryId}`}
          value={topicId}
          onChange={(e) => setTopicId(e.target.value)}
          className={inputClass}
        >
          <option value="">No specific curriculum topic</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
              {t.id === suggestedTopicId ? " (this week)" : ""}
            </option>
          ))}
        </select>
        {suggestedTopicId && (
          <p className="text-xs text-ink-soft">
            Pre-selected from this week&apos;s scheme of work. Change it if you taught something
            else.
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor={`objectives-${timetableEntryId}`} className="text-xs font-medium text-ink">
          Lesson objectives <span className="font-normal text-ink-soft">(optional)</span>
        </label>
        <textarea
          id={`objectives-${timetableEntryId}`}
          value={objectives}
          onChange={(e) => setObjectives(e.target.value)}
          rows={2}
          className={inputClass}
        />
      </div>

      <fieldset className="space-y-2 rounded-lg border border-rule bg-white p-3">
        <legend className="px-1 text-xs font-medium text-ink">
          Homework <span className="font-normal text-ink-soft">(optional)</span>
        </legend>
        <textarea
          aria-label="Homework"
          placeholder="What should students do?"
          value={homework}
          onChange={(e) => setHomework(e.target.value)}
          rows={2}
          className={inputClass}
        />

        <HomeworkDueDateField
          id={`due-${timetableEntryId}`}
          value={homeworkDueAt}
          onChange={setHomeworkDueAt}
          min={today}
          disabled={!homework.trim()}
        />
        {!homework.trim() && (
          <p className="text-xs text-ink-soft">Write the homework first to set a due date.</p>
        )}
      </fieldset>

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
          onClick={onCloseAction}
          className="rounded-lg border border-rule px-3 py-1.5 text-sm text-ink-soft"
        >
          Cancel
        </button>
      </div>

      {error && <p className="text-sm text-clay">{error}</p>}
    </form>
  );
}
