"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  startQuizAttempt,
  getQuizAttemptQuestions,
  answerQuizQuestion,
  submitQuizAttempt,
} from "@/lib/actions/quizAttempt";
import { emitToast } from "@/lib/toast";
import type { QuizAttemptQuestionRow } from "@/types/database";

type Question = {
  id: string;
  text: string;
  points: number;
  options: { id: string; text: string }[];
};

function groupQuestions(rows: QuizAttemptQuestionRow[]): {
  questions: Question[];
  answered: Record<string, string>;
} {
  const byId = new Map<string, Question>();
  const answered: Record<string, string> = {};

  for (const r of rows) {
    if (!byId.has(r.question_id)) {
      byId.set(r.question_id, {
        id: r.question_id,
        text: r.question_text,
        points: r.points,
        options: [],
      });
    }
    byId.get(r.question_id)!.options.push({ id: r.option_id, text: r.option_text });
    if (r.selected_option_id) answered[r.question_id] = r.selected_option_id;
  }

  return { questions: [...byId.values()], answered };
}

function formatClock(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function QuizAttemptRunner({
  quizId,
  quizTitle,
  durationMinutes,
}: {
  quizId: string;
  quizTitle: string;
  durationMinutes: number;
}) {
  const router = useRouter();
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; total_points: number } | null>(null);
  const hasSubmitted = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const attempt = await startQuizAttempt(quizId);
        if (cancelled) return;
        setAttemptId(attempt.id);

        const elapsedSeconds = Math.floor(
          (Date.now() - new Date(attempt.started_at).getTime()) / 1000
        );
        const remaining = Math.max(0, durationMinutes * 60 - elapsedSeconds);
        setSecondsLeft(remaining);

        const rows = await getQuizAttemptQuestions(attempt.id);
        if (cancelled) return;
        const { questions: qs, answered } = groupQuestions(rows);
        setQuestions(qs);
        setAnswers(answered);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [quizId, durationMinutes]);

  const doSubmit = useCallback(async () => {
    if (!attemptId || hasSubmitted.current) return;
    hasSubmitted.current = true;
    setSubmitting(true);
    try {
      const res = await submitQuizAttempt(attemptId);
      setResult(res);
    } catch (err) {
      emitToast(err instanceof Error ? err.message : "Something went wrong.", "error");
      hasSubmitted.current = false;
    } finally {
      setSubmitting(false);
    }
  }, [attemptId]);

  useEffect(() => {
    if (secondsLeft === null || result) return;
    if (secondsLeft <= 0) {
      doSubmit();
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => (s !== null ? s - 1 : s)), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft, result, doSubmit]);

  function selectOption(questionId: string, optionId: string) {
    setAnswers((a) => ({ ...a, [questionId]: optionId }));
    if (attemptId) {
      answerQuizQuestion(attemptId, questionId, optionId).catch((err) => {
        emitToast(err instanceof Error ? err.message : "Couldn't save that answer.", "error");
      });
    }
  }

  if (loading) return <p className="text-sm text-ink-soft">Loading quiz…</p>;
  if (loadError) return <p className="text-sm text-clay">{loadError}</p>;

  if (result) {
    return (
      <div className="max-w-lg rounded-xl border border-rule bg-white p-6 text-center">
        <p className="mb-1 font-display text-xl font-semibold text-ink">Submitted</p>
        <p className="mb-4 text-sm text-ink-soft">
          {result.score}/{result.total_points} — your score is pending your teacher&apos;s approval.
        </p>
        <button
          onClick={() => router.push("/dashboard/student/quizzes")}
          className="rounded-lg bg-leaf px-4 py-2 text-sm font-medium text-white hover:bg-leaf/90"
        >
          Back to quizzes
        </button>
      </div>
    );
  }

  const answeredCount = Object.keys(answers).length;

  return (
    <div className="max-w-2xl">
      <div className="sticky top-0 z-10 mb-4 flex items-center justify-between rounded-xl border border-rule bg-white/95 p-3 backdrop-blur">
        <div>
          <p className="text-sm font-medium text-ink">{quizTitle}</p>
          <p className="text-xs text-ink-soft">
            {answeredCount}/{questions.length} answered
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-semibold ${
            secondsLeft !== null && secondsLeft < 60
              ? "bg-clay/10 text-clay"
              : "bg-marigold-soft text-ink"
          }`}
        >
          {secondsLeft !== null ? formatClock(secondsLeft) : "--:--"}
        </span>
      </div>

      <div className="space-y-4">
        {questions.map((q, i) => (
          <div key={q.id} className="rounded-xl border border-rule bg-white p-4">
            <p className="mb-3 text-sm font-medium text-ink">
              {i + 1}. {q.text} <span className="text-ink-soft">({q.points} pts)</span>
            </p>
            <div className="space-y-2">
              {q.options.map((o) => (
                <label
                  key={o.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                    answers[q.id] === o.id
                      ? "border-leaf bg-leaf-soft"
                      : "border-rule hover:bg-paper"
                  }`}
                >
                  <input
                    type="radio"
                    name={`q-${q.id}`}
                    checked={answers[q.id] === o.id}
                    onChange={() => selectOption(q.id, o.id)}
                  />
                  {o.text}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={doSubmit}
        disabled={submitting}
        className="mt-6 rounded-lg bg-leaf px-4 py-2 text-sm font-medium text-white hover:bg-leaf/90 disabled:opacity-60"
      >
        {submitting ? "Submitting…" : "Submit quiz"}
      </button>
    </div>
  );
}
