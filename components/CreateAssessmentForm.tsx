"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createAssessmentSchema, fieldErrorsFrom } from "@/lib/validation";

const STANDARD_ASSESSMENTS = [
  { title: "1st CA", max_score: 20 },
  { title: "2nd CA", max_score: 20 },
  { title: "Exam", max_score: 60 },
];

export function CreateAssessmentForm({
  teacherId,
  subjects,
  classes,
}: {
  teacherId: string;
  subjects: { id: string; name: string }[];
  classes: { id: string; name: string; arm: string | null }[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [term, setTerm] = useState(1);
  const [academicYear, setAcademicYear] = useState(defaultAcademicYear());
  const [customTitle, setCustomTitle] = useState("");
  const [customMaxScore, setCustomMaxScore] = useState(20);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  function defaultAcademicYear() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    return month >= 9 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
  }

  function handleCreateStandardSet() {
    setError(null);
    setMessage(null);

    const errors = fieldErrorsFrom(createAssessmentSchema, {
      subjectId,
      classId,
      term,
      academicYear,
    });
    if (errors) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    startTransition(async () => {
      // Skip any that already exist for this subject/class/term/year, so
      // clicking this twice doesn't create duplicates.
      const { data: existing } = await supabase
        .from("assessments")
        .select("title")
        .eq("subject_id", subjectId)
        .eq("class_id", classId)
        .eq("term", term)
        .eq("academic_year", academicYear);

      const existingTitles = new Set((existing ?? []).map((a) => a.title));
      const toCreate = STANDARD_ASSESSMENTS.filter((a) => !existingTitles.has(a.title));

      if (!toCreate.length) {
        setMessage("1st CA, 2nd CA, and Exam already exist for this subject/class/term.");
        return;
      }

      const { error: insertError } = await supabase.from("assessments").insert(
        toCreate.map((a) => ({
          subject_id: subjectId,
          class_id: classId,
          title: a.title,
          max_score: a.max_score,
          term,
          academic_year: academicYear,
          created_by: teacherId,
        }))
      );

      if (insertError) {
        setError(insertError.message);
        return;
      }

      setMessage(
        `Created: ${toCreate.map((a) => `${a.title} (${a.max_score})`).join(", ")}.`
      );
      router.refresh();
    });
  }

  function handleCreateCustom(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const errors = fieldErrorsFrom(createAssessmentSchema, {
      subjectId,
      classId,
      term,
      academicYear,
      customTitle,
      customMaxScore,
    });
    if (errors) {
      setFieldErrors(errors);
      return;
    }
    if (!customTitle.trim()) {
      setFieldErrors({ customTitle: "Enter a title for this assessment." });
      return;
    }
    setFieldErrors({});

    startTransition(async () => {
      const { error: insertError } = await supabase.from("assessments").insert({
        subject_id: subjectId,
        class_id: classId,
        title: customTitle,
        max_score: customMaxScore,
        term,
        academic_year: academicYear,
        created_by: teacherId,
      });

      if (insertError) {
        setError(insertError.message);
        return;
      }

      setMessage(`Created "${customTitle}" (${customMaxScore} marks).`);
      setCustomTitle("");
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-marigold px-4 py-2 text-sm font-medium text-ink hover:bg-marigold-dark"
      >
        + New assessment
      </button>
    );
  }

  return (
    <div className="mb-6 space-y-4 rounded-xl border border-rule bg-white p-4">
      <div className="grid grid-cols-4 gap-3">
        <select
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          className="rounded-lg border border-rule px-3 py-2 text-sm"
        >
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          className="rounded-lg border border-rule px-3 py-2 text-sm"
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} {c.arm}
            </option>
          ))}
        </select>
        <select
          value={term}
          onChange={(e) => setTerm(Number(e.target.value))}
          className="rounded-lg border border-rule px-3 py-2 text-sm"
        >
          <option value={1}>Term 1</option>
          <option value={2}>Term 2</option>
          <option value={3}>Term 3</option>
        </select>
        <div>
          <input
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            className="w-full rounded-lg border border-rule px-3 py-2 text-sm"
          />
          {fieldErrors.academicYear && (
            <p className="mt-1 text-xs text-clay">{fieldErrors.academicYear}</p>
          )}
        </div>
      </div>

      <div className="rounded-lg bg-paper p-3">
        <p className="mb-2 text-sm font-medium text-ink">
          Standard set: 1st CA (20) + 2nd CA (20) + Exam (60)
        </p>
        <button
          onClick={handleCreateStandardSet}
          disabled={isPending}
          className="rounded-lg bg-leaf px-3 py-2 text-sm font-medium text-white hover:bg-leaf/90 disabled:opacity-60"
        >
          {isPending ? "Creating…" : "Create standard set"}
        </button>
      </div>

      <form onSubmit={handleCreateCustom} className="rounded-lg bg-paper p-3">
        <p className="mb-2 text-sm font-medium text-ink">Or add a custom assessment</p>
        <div className="flex gap-2">
          <div className="flex-1">
            <input
              placeholder="Title (e.g. Mid-term Test)"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              className="w-full rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
            />
            {fieldErrors.customTitle && (
              <p className="mt-1 text-xs text-clay">{fieldErrors.customTitle}</p>
            )}
          </div>
          <div>
            <input
              type="number"
              min={1}
              value={customMaxScore}
              onChange={(e) => setCustomMaxScore(Number(e.target.value))}
              className="w-24 rounded-lg border border-rule px-3 py-2 text-sm"
            />
            {fieldErrors.customMaxScore && (
              <p className="mt-1 text-xs text-clay">{fieldErrors.customMaxScore}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="h-fit rounded-lg border border-rule px-3 py-2 text-sm text-ink hover:bg-white disabled:opacity-60"
          >
            Add
          </button>
        </div>
      </form>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-rule px-3 py-2 text-sm text-ink-soft"
        >
          Close
        </button>
      </div>

      {message && <p className="text-sm text-leaf">{message}</p>}
      {error && <p className="text-sm text-clay">{error}</p>}
    </div>
  );
}