"use client";

import { useState, useTransition } from "react";
import { saveGrade } from "@/lib/actions/teacher";

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
  const [isPending, startTransition] = useTransition();
  const [savedId, setSavedId] = useState<string | null>(null);

  function handleSave(studentId: string) {
    const raw = scores[studentId];
    const score = parseFloat(raw);
    if (isNaN(score) || score < 0 || score > maxScore) return;

    startTransition(async () => {
      await saveGrade(assessmentId, studentId, score);
      setSavedId(studentId);
    });
  }

  return (
    <div className="space-y-2">
      {students.map((student) => (
        <div
          key={student.id}
          className="flex items-center justify-between rounded-lg border border-rule bg-white px-4 py-3"
        >
          <span className="text-ink">{student.full_name}</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={maxScore}
              value={scores[student.id]}
              onChange={(e) =>
                setScores((prev) => ({ ...prev, [student.id]: e.target.value }))
              }
              className="w-20 rounded-md border border-rule px-2 py-1 text-sm outline-none focus-visible:border-marigold"
              placeholder={`/ ${maxScore}`}
            />
            <button
              onClick={() => handleSave(student.id)}
              disabled={isPending}
              className="rounded-md bg-marigold px-2.5 py-1 text-xs font-medium text-ink hover:bg-marigold-dark disabled:opacity-60"
            >
              Save
            </button>
            {savedId === student.id && (
              <span className="text-xs text-leaf">Saved</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
