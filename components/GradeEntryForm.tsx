"use client";

import { useState, useTransition } from "react";
import { saveGrade } from "@/lib/actions/teacher";
import { emitToast } from "@/lib/toast";

const COMMENT_BANK = [
  "Excellent work",
  "Good effort",
  "Satisfactory",
  "Needs improvement",
  "Please see me",
  "Incomplete submission",
];

export function GradeEntryForm({
  assessmentId,
  maxScore,
  students,
  initialGrades,
}: {
  assessmentId: string;
  maxScore: number;
  students: { id: string; full_name: string }[];
  initialGrades: Record<string, { score: number; remark: string | null }>;
}) {
  const [scores, setScores] = useState<Record<string, string>>(() => {
    const base: Record<string, string> = {};
    for (const s of students) {
      base[s.id] = initialGrades[s.id]?.score?.toString() ?? "";
    }
    return base;
  });
  const [remarks, setRemarks] = useState<Record<string, string>>(() => {
    const base: Record<string, string> = {};
    for (const s of students) {
      base[s.id] = initialGrades[s.id]?.remark ?? "";
    }
    return base;
  });
  const [openCommentBank, setOpenCommentBank] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [errorId, setErrorId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleSave(studentId: string) {
    const raw = scores[studentId];
    const score = parseFloat(raw);
    if (isNaN(score) || score < 0 || score > maxScore) {
      const message = `Enter a score between 0 and ${maxScore}.`;
      setErrorId(studentId);
      setErrorMessage(message);
      emitToast(message, "error");
      return;
    }

    setErrorId(null);
    setErrorMessage(null);

    startTransition(async () => {
      try {
        await saveGrade(assessmentId, studentId, score, remarks[studentId] || undefined);
        emitToast("Grade saved.");
      } catch (err: any) {
        // Previously unhandled — a rejected saveGrade() call here (e.g.
        // the "you aren't assigned to teach this subject" RLS pre-check)
        // would silently do nothing. Now it surfaces per-row.
        const message = err.message ?? "Something went wrong saving this grade.";
        setErrorId(studentId);
        setErrorMessage(message);
        emitToast(message, "error");
      }
    });
  }

  function applyComment(studentId: string, comment: string) {
    setRemarks((prev) => ({ ...prev, [studentId]: comment }));
    setOpenCommentBank(null);
  }

  return (
    <div className="space-y-2">
      {students.map((student) => (
        <div key={student.id} className="rounded-lg border border-rule bg-white px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-ink">{student.full_name}</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={maxScore}
                value={scores[student.id]}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    setScores((prev) => ({ ...prev, [student.id]: "" }));
                    return;
                  }
                  const parsed = parseFloat(raw);
                  if (isNaN(parsed)) return;
                  const clamped = Math.min(Math.max(parsed, 0), maxScore);
                  setScores((prev) => ({ ...prev, [student.id]: clamped.toString() }));
                }}
                className="w-20 rounded-md border border-rule px-2 py-1 text-sm outline-none focus-visible:border-marigold"
                placeholder={`/ ${maxScore}`}
              />
              <button
                onClick={() => handleSave(student.id)}
                disabled={isPending}
                className="rounded-md bg-marigold px-2.5 py-1 text-xs font-medium text-ink hover:bg-marigold-dark disabled:opacity-60"
              >
                {isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <input
              value={remarks[student.id]}
              onChange={(e) => setRemarks((prev) => ({ ...prev, [student.id]: e.target.value }))}
              placeholder="Remark (optional)"
              className="flex-1 rounded-md border border-rule px-2 py-1 text-xs outline-none focus-visible:border-marigold"
            />
            <div className="relative">
              <button
                type="button"
                onClick={() =>
                  setOpenCommentBank((prev) => (prev === student.id ? null : student.id))
                }
                className="whitespace-nowrap rounded-md border border-rule px-2 py-1 text-xs text-ink-soft hover:bg-paper"
              >
                Quick remark
              </button>
              {openCommentBank === student.id && (
                <div className="absolute right-0 z-10 mt-1 w-48 rounded-lg border border-rule bg-white p-1 shadow-md">
                  {COMMENT_BANK.map((comment) => (
                    <button
                      key={comment}
                      type="button"
                      onClick={() => applyComment(student.id, comment)}
                      className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-ink hover:bg-paper"
                    >
                      {comment}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {errorId === student.id && errorMessage && (
            <p className="mt-1 text-xs text-clay">{errorMessage}</p>
          )}
        </div>
      ))}
    </div>
  );
}
