"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { deleteCurriculumTopic } from "@/lib/actions/curriculum";
import { curriculumTopicSchema, fieldErrorsFrom } from "@/lib/validation";
import type { CurriculumTopic } from "@/types/database";

export function TopicRow({
  topic,
  subjectName,
  minLevel,
  maxLevel,
}: {
  topic: CurriculumTopic;
  subjectName: string;
  minLevel: number;
  maxLevel: number;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(topic.title);
  const [description, setDescription] = useState(topic.description ?? "");
  const [theme, setTheme] = useState(topic.theme ?? "");
  const [levelNumber, setLevelNumber] = useState(topic.level_number);
  const [term, setTerm] = useState(topic.term);
  const [academicYear, setAcademicYear] = useState(topic.academic_year);
  const [weekNumber, setWeekNumber] = useState(topic.week_number);
  const [weekEndNumber, setWeekEndNumber] = useState(topic.week_end_number);
  const [sequenceOrder, setSequenceOrder] = useState(topic.sequence_order);

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const errors = fieldErrorsFrom(curriculumTopicSchema, {
      subjectId: topic.subject_id,
      levelNumber,
      term,
      academicYear,
      theme,
      weekNumber,
      weekEndNumber,
      sequenceOrder,
      title,
      description,
    });
    if (errors) {
      setFieldErrors(errors);
      return;
    }
    if (levelNumber < minLevel || levelNumber > maxLevel) {
      setFieldErrors({ levelNumber: `${subjectName} only covers levels ${minLevel}–${maxLevel}.` });
      return;
    }
    setFieldErrors({});

    startTransition(async () => {
      const { error: updateError } = await supabase
        .from("curriculum_topics")
        .update({
          title: title.trim(),
          description: description.trim() || null,
          theme: theme.trim() || null,
          level_number: levelNumber,
          term,
          academic_year: academicYear,
          week_number: weekNumber,
          week_end_number: weekEndNumber,
          sequence_order: sequenceOrder,
        })
        .eq("id", topic.id);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setEditing(false);
      router.refresh();
    });
  }

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      try {
        await deleteCurriculumTopic(topic.id);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
        setConfirmingDelete(false);
      }
    });
  }

  if (editing) {
    return (
      <form onSubmit={handleSave} className="space-y-2 rounded-lg border border-rule bg-paper p-3">
        <input
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          className="w-full rounded-lg border border-rule px-3 py-2 text-sm"
          placeholder="Theme (optional — groups related topics)"
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <input
            type="number"
            min={minLevel}
            max={maxLevel}
            value={levelNumber}
            onChange={(e) => setLevelNumber(Number(e.target.value))}
            className="rounded-lg border border-rule px-3 py-2 text-sm"
            placeholder="Level"
          />
          <select
            value={term}
            onChange={(e) => setTerm(Number(e.target.value))}
            className="rounded-lg border border-rule px-3 py-2 text-sm"
          >
            <option value={1}>Term 1</option>
            <option value={2}>Term 2</option>
            <option value={3}>Term 3</option>
          </select>
          <input
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            className="rounded-lg border border-rule px-3 py-2 text-sm"
            placeholder="2025/2026"
          />
          <input
            type="number"
            min={1}
            max={14}
            value={weekNumber}
            onChange={(e) => {
              const n = Number(e.target.value);
              setWeekNumber(n);
              if (n > weekEndNumber) setWeekEndNumber(n);
            }}
            className="rounded-lg border border-rule px-3 py-2 text-sm"
            placeholder="Week from"
          />
          <input
            type="number"
            min={weekNumber}
            max={14}
            value={weekEndNumber}
            onChange={(e) => setWeekEndNumber(Number(e.target.value))}
            className="rounded-lg border border-rule px-3 py-2 text-sm"
            placeholder="Week to"
          />
        </div>
        {fieldErrors.levelNumber && <p className="text-xs text-clay">{fieldErrors.levelNumber}</p>}
        {fieldErrors.academicYear && (
          <p className="text-xs text-clay">{fieldErrors.academicYear}</p>
        )}
        {fieldErrors.weekNumber && <p className="text-xs text-clay">{fieldErrors.weekNumber}</p>}
        {fieldErrors.weekEndNumber && (
          <p className="text-xs text-clay">{fieldErrors.weekEndNumber}</p>
        )}

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg border border-rule px-3 py-2 text-sm"
          placeholder="Topic title"
        />
        {fieldErrors.title && <p className="text-xs text-clay">{fieldErrors.title}</p>}

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-rule px-3 py-2 text-sm"
          placeholder="Description / learning objectives"
        />

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-ink-soft">
            Order
            <input
              type="number"
              min={1}
              value={sequenceOrder}
              onChange={(e) => setSequenceOrder(Number(e.target.value))}
              className="w-16 rounded-lg border border-rule px-2 py-1 text-sm"
            />
          </label>
          <div className="ml-auto flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-leaf px-3 py-1.5 text-sm font-medium text-white hover:bg-leaf/90 disabled:opacity-60"
            >
              {isPending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg border border-rule px-3 py-1.5 text-sm text-ink-soft"
            >
              Cancel
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-clay">{error}</p>}
      </form>
    );
  }

  const weekLabel =
    topic.week_end_number > topic.week_number
      ? `Weeks ${topic.week_number}–${topic.week_end_number}`
      : `Week ${topic.week_number}`;

  return (
    <div className="flex items-center justify-between rounded-lg border border-rule bg-white px-4 py-3">
      <div>
        <p className="text-ink">
          {weekLabel}: {topic.title}
        </p>
        <p className="text-xs text-ink-soft">
          {topic.theme ? `${topic.theme} · ` : ""}Term {topic.term} · {topic.academic_year} · Order{" "}
          {topic.sequence_order}
          {topic.description ? ` · ${topic.description}` : ""}
        </p>
        {error && <p className="mt-1 text-xs text-clay">{error}</p>}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={() => setEditing(true)}
          className="rounded-lg border border-rule px-3 py-1.5 text-sm text-ink-soft hover:bg-paper"
        >
          Edit
        </button>
        {confirmingDelete ? (
          <>
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="rounded-lg bg-clay px-3 py-1.5 text-sm font-medium text-white hover:bg-clay/90 disabled:opacity-60"
            >
              {isPending ? "Deleting…" : "Confirm delete"}
            </button>
            <button
              onClick={() => setConfirmingDelete(false)}
              className="rounded-lg border border-rule px-3 py-1.5 text-sm text-ink-soft"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setConfirmingDelete(true)}
            className="rounded-lg border border-rule px-3 py-1.5 text-sm text-clay hover:bg-clay/10"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
