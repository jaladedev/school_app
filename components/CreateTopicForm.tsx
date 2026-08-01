"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { curriculumTopicSchema, fieldErrorsFrom } from "@/lib/validation";
import type { CurriculumTopic, EducationLevel } from "@/types/database";

type SubjectOption = {
  id: string;
  name: string;
  education_level: EducationLevel;
  min_level_number: number;
  max_level_number: number;
};

export function CreateTopicForm({
  subjects,
  defaultAcademicYear,
  defaultTerm,
  existingTopics,
}: {
  subjects: SubjectOption[];
  defaultAcademicYear: string;
  defaultTerm: number;
  // Passed as plain data rather than a "next sequence order" function —
  // Server Components can't hand a client component a plain closure
  // (only Server Actions cross that boundary), so the computation has to
  // happen here instead of in the page.
  existingTopics: Pick<
    CurriculumTopic,
    "subject_id" | "level_number" | "term" | "sequence_order"
  >[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const subject = subjects.find((s) => s.id === subjectId);

  const [levelNumber, setLevelNumber] = useState(subject?.min_level_number ?? 1);
  const [term, setTerm] = useState(defaultTerm);
  const [academicYear, setAcademicYear] = useState(defaultAcademicYear);
  const [weekNumber, setWeekNumber] = useState(1);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function handleSubjectChange(id: string) {
    setSubjectId(id);
    const s = subjects.find((sub) => sub.id === id);
    if (s) setLevelNumber(s.min_level_number);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const errors = fieldErrorsFrom(curriculumTopicSchema, {
      subjectId,
      levelNumber,
      term,
      academicYear,
      weekNumber,
      sequenceOrder: 1, // placeholder — the real value is computed just below
      title,
      description,
    });
    if (errors) {
      setFieldErrors(errors);
      return;
    }
    if (!subject) {
      setError("Select a subject.");
      return;
    }
    if (levelNumber < subject.min_level_number || levelNumber > subject.max_level_number) {
      setFieldErrors({
        levelNumber: `${subject.name} only covers levels ${subject.min_level_number}–${subject.max_level_number}.`,
      });
      return;
    }
    setFieldErrors({});

    const matching = existingTopics.filter(
      (t) => t.subject_id === subjectId && t.level_number === levelNumber && t.term === term
    );
    const sequenceOrder = matching.length
      ? Math.max(...matching.map((t) => t.sequence_order)) + 1
      : 1;

    startTransition(async () => {
      const { error: insertError } = await supabase.from("curriculum_topics").insert({
        subject_id: subjectId,
        education_level: subject.education_level,
        level_number: levelNumber,
        term,
        academic_year: academicYear,
        title: title.trim(),
        description: description.trim() || null,
        week_number: weekNumber,
        sequence_order: sequenceOrder,
      });

      if (insertError) {
        setError(insertError.message);
        return;
      }

      setTitle("");
      setDescription("");
      setOpen(false);
      router.refresh();
    });
  }

  if (!subjects.length) {
    return (
      <p className="text-sm text-ink-soft">
        Create a subject first before adding scheme-of-work topics.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-marigold px-4 py-2 text-sm font-medium text-ink hover:bg-marigold-dark"
      >
        + New topic
      </button>
    );
  }

  // Guards against a subject whose min/max level range is reversed (bad data
  // from before subjects could be edited) -- Array.from with a negative
  // length throws, and would otherwise take this whole form down instead of
  // just leaving the level dropdown with its one fallback option.
  const levelNumbers =
    subject && subject.max_level_number >= subject.min_level_number
      ? Array.from(
          { length: subject.max_level_number - subject.min_level_number + 1 },
          (_, i) => subject.min_level_number + i
        )
      : subject
        ? [subject.min_level_number]
        : undefined;

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 space-y-3 rounded-xl border border-rule bg-white p-4"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <select
            value={subjectId}
            onChange={(e) => handleSubjectChange(e.target.value)}
            className="w-full rounded-lg border border-rule px-3 py-2 text-sm"
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <select
            value={levelNumber}
            onChange={(e) => setLevelNumber(Number(e.target.value))}
            className="w-full rounded-lg border border-rule px-3 py-2 text-sm"
          >
            {levelNumbers?.map((n) => (
              <option key={n} value={n}>
                {subject?.education_level.toUpperCase()} {n}
              </option>
            ))}
          </select>
          {fieldErrors.levelNumber && (
            <p className="mt-1 text-xs text-clay">{fieldErrors.levelNumber}</p>
          )}
        </div>
        <div>
          <select
            value={term}
            onChange={(e) => setTerm(Number(e.target.value))}
            className="w-full rounded-lg border border-rule px-3 py-2 text-sm"
          >
            <option value={1}>Term 1</option>
            <option value={2}>Term 2</option>
            <option value={3}>Term 3</option>
          </select>
        </div>
        <div>
          <input
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            placeholder="2025/2026"
            className="w-full rounded-lg border border-rule px-3 py-2 text-sm"
          />
          {fieldErrors.academicYear && (
            <p className="mt-1 text-xs text-clay">{fieldErrors.academicYear}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-soft">Week</p>
          <input
            type="number"
            min={1}
            max={14}
            value={weekNumber}
            onChange={(e) => setWeekNumber(Number(e.target.value))}
            className="w-full rounded-lg border border-rule px-3 py-2 text-sm"
          />
          {fieldErrors.weekNumber && (
            <p className="mt-1 text-xs text-clay">{fieldErrors.weekNumber}</p>
          )}
        </div>
        <div className="col-span-3">
          <input
            required
            placeholder="Topic title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
          />
          {fieldErrors.title && <p className="mt-1 text-xs text-clay">{fieldErrors.title}</p>}
        </div>
      </div>

      <textarea
        placeholder="Description / learning objectives (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        className="w-full rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
      />

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-leaf px-3 py-2 text-sm font-medium text-white hover:bg-leaf/90 disabled:opacity-60"
        >
          {isPending ? "Creating…" : "Create topic"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-rule px-3 py-2 text-sm text-ink-soft"
        >
          Cancel
        </button>
      </div>

      {error && <p className="text-sm text-clay">{error}</p>}
    </form>
  );
}
