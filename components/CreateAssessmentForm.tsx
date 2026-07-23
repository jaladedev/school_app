"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createStandardAssessmentSet, createCustomAssessment } from "@/lib/actions/teacher";
import { createAssessmentSchema, fieldErrorsFrom } from "@/lib/validation";
import type { AssessmentType } from "@/types/database";

const CUSTOM_ASSESSMENT_TYPES: { value: AssessmentType; label: string }[] = [
  { value: "test", label: "Test" },
  { value: "assignment", label: "Assignment" },
  { value: "project", label: "Project" },
  { value: "practical", label: "Practical" },
  { value: "other", label: "Other" },
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

  const [open, setOpen] = useState(false);
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [term, setTerm] = useState(1);
  const [academicYear, setAcademicYear] = useState(defaultAcademicYear());
  const [customType, setCustomType] = useState<AssessmentType>("other");
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
      try {
        const { created } = await createStandardAssessmentSet({
          subjectId,
          classId,
          term,
          academicYear,
        });

        if (!created.length) {
          setMessage("1st CA, 2nd CA, and Exam already exist for this subject/class/term.");
          return;
        }

        setMessage(`Created: ${created.join(", ")}.`);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
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
      assessmentType: customType,
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
      try {
        await createCustomAssessment({
          subjectId,
          classId,
          term,
          academicYear,
          assessmentType: customType,
          title: customTitle,
          maxScore: customMaxScore,
        });

        setMessage(`Created "${customTitle}" (${customMaxScore} marks).`);
        setCustomTitle("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
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
        <p className="mb-2 text-sm font-medium text-ink">Or add another assessment</p>
        <div className="flex gap-2">
          <select
            value={customType}
            onChange={(e) => setCustomType(e.target.value as AssessmentType)}
            className="rounded-lg border border-rule px-3 py-2 text-sm"
          >
            {CUSTOM_ASSESSMENT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
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
