"use client";

import { useState, useTransition } from "react";
import { gradeQuizEssayAnswers } from "@/lib/actions/quiz";
import { emitToast } from "@/lib/toast";

type EssayAnswer = {
  questionId: string;
  questionText: string;
  points: number;
  answerText: string | null;
  pointsAwarded: number | null;
};

export function EssayGradingForm({
  quizId,
  attemptId,
  essayAnswers,
}: {
  quizId: string;
  attemptId: string;
  essayAnswers: EssayAnswer[];
}) {
  const [scores, setScores] = useState<Record<string, string>>(
    Object.fromEntries(
      essayAnswers.map((a) => [a.questionId, a.pointsAwarded != null ? String(a.pointsAwarded) : ""])
    )
  );
  const [isPending, startTransition] = useTransition();

  function submit() {
    const parsed: Record<string, number> = {};
    for (const a of essayAnswers) {
      const raw = scores[a.questionId];
      if (raw === undefined || raw === "") continue;
      const n = Number(raw);
      if (Number.isNaN(n) || n < 0 || n > a.points) {
        emitToast(`Score for "${a.questionText.slice(0, 30)}…" must be 0–${a.points}.`, "error");
        return;
      }
      parsed[a.questionId] = n;
    }
    if (!Object.keys(parsed).length) return;

    startTransition(async () => {
      try {
        await gradeQuizEssayAnswers(quizId, attemptId, parsed);
        emitToast("Essay scores saved.");
      } catch (err) {
        emitToast(err instanceof Error ? err.message : "Something went wrong.", "error");
      }
    });
  }

  if (!essayAnswers.length) return null;

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-rule bg-paper p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">Essay grading</p>
      {essayAnswers.map((a) => (
        <div key={a.questionId} className="space-y-1">
          <p className="text-sm text-ink-soft">{a.questionText}</p>
          <p className="whitespace-pre-wrap rounded-lg border border-rule bg-white p-2 text-sm text-ink">
            {a.answerText || <span className="italic text-ink-soft">No answer submitted.</span>}
          </p>
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            Points (of {a.points})
            <input
              type="number"
              min={0}
              max={a.points}
              step={0.5}
              value={scores[a.questionId] ?? ""}
              onChange={(e) => setScores((s) => ({ ...s, [a.questionId]: e.target.value }))}
              className="w-20 rounded-lg border border-rule px-2 py-1 text-sm"
            />
          </label>
        </div>
      ))}
      <button
        type="button"
        onClick={submit}
        disabled={isPending}
        className="rounded-lg bg-leaf px-3 py-1.5 text-sm font-medium text-white hover:bg-leaf/90 disabled:opacity-60"
      >
        {isPending ? "Saving…" : "Save essay scores"}
      </button>
    </div>
  );
}
