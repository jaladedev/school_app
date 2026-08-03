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
import { QuestionText } from "@/components/QuestionText";
import type { QuizAttemptQuestionRow } from "@/types/database";

type Question = {
  id: string;
  text: string;
  points: number;
  type: QuizAttemptQuestionRow["question_type"];
  options: { id: string; text: string; matchPrompt: string | null }[];
};

function groupQuestions(rows: QuizAttemptQuestionRow[]): {
  questions: Question[];
  selected: Record<string, string>;
  text: Record<string, string>;
  matched: Record<string, Record<string, string>>;
} {
  const byId = new Map<string, Question>();
  const selected: Record<string, string> = {};
  const text: Record<string, string> = {};
  const matched: Record<string, Record<string, string>> = {};

  for (const r of rows) {
    if (!byId.has(r.question_id)) {
      byId.set(r.question_id, {
        id: r.question_id,
        text: r.question_text,
        points: r.points,
        type: r.question_type,
        options: [],
      });
    }
    if (r.option_id) {
      byId
        .get(r.question_id)!
        .options.push({ id: r.option_id, text: r.option_text ?? "", matchPrompt: r.match_prompt });
    }
    if (r.selected_option_id) selected[r.question_id] = r.selected_option_id;
    if (r.answer_text) text[r.question_id] = r.answer_text;
    if (r.matched_pairs) matched[r.question_id] = r.matched_pairs;
  }

  return { questions: [...byId.values()], selected, text, matched };
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
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [textAnswers, setTextAnswers] = useState<Record<string, string>>({});
  const [matchedAnswers, setMatchedAnswers] = useState<Record<string, Record<string, string>>>({});
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
        const { questions: qs, selected, text, matched } = groupQuestions(rows);
        setQuestions(qs);
        setSelectedAnswers(selected);
        setTextAnswers(text);
        setMatchedAnswers(matched);
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
    setSelectedAnswers((a) => ({ ...a, [questionId]: optionId }));
    if (attemptId) {
      answerQuizQuestion(attemptId, questionId, { selectedOptionId: optionId }).catch((err) => {
        emitToast(err instanceof Error ? err.message : "Couldn't save that answer.", "error");
      });
    }
  }

  function setTextAnswer(questionId: string, value: string) {
    setTextAnswers((a) => ({ ...a, [questionId]: value }));
    if (attemptId) {
      answerQuizQuestion(attemptId, questionId, { answerText: value }).catch((err) => {
        emitToast(err instanceof Error ? err.message : "Couldn't save that answer.", "error");
      });
    }
  }

  function setMatchAnswer(questionId: string, optionId: string, chosenText: string) {
    setMatchedAnswers((a) => {
      const next = { ...a, [questionId]: { ...(a[questionId] ?? {}), [optionId]: chosenText } };
      if (attemptId) {
        answerQuizQuestion(attemptId, questionId, { matchedPairs: next[questionId] }).catch(
          (err) => {
            emitToast(err instanceof Error ? err.message : "Couldn't save that answer.", "error");
          }
        );
      }
      return next;
    });
  }

  if (loading) return <p className="text-sm text-ink-soft">Loading quiz…</p>;
  if (loadError) return <p className="text-sm text-clay">{loadError}</p>;

  if (result) {
    const hasEssayQuestions = questions.some((q) => q.type === "essay");
    return (
      <div className="max-w-lg rounded-xl border border-rule bg-white p-6 text-center">
        <p className="mb-1 font-display text-xl font-semibold text-ink">Submitted</p>
        <p className="mb-4 text-sm text-ink-soft">
          {hasEssayQuestions ? (
            "Your teacher still needs to grade one or more written answers before your final score is ready."
          ) : (
            <>
              {result.score}/{result.total_points}
            </>
          )}
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

  function isAnswered(q: Question) {
    if (q.type === "matching") {
      return q.options.every((o) => (matchedAnswers[q.id]?.[o.id] ?? "").trim());
    }
    if (q.type === "fill_blank" || q.type === "essay") {
      return (textAnswers[q.id] ?? "").trim().length > 0;
    }
    return Boolean(selectedAnswers[q.id]);
  }

  const answeredCount = questions.filter(isAnswered).length;

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
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-soft">
                Question {i + 1}
              </span>
              <span className="text-xs text-ink-soft">{q.points} pts</span>
            </div>
            <QuestionText text={q.text} className="mb-3" />

            {(q.type === "mcq" || q.type === "true_false") && (
              <div className="space-y-2">
                {q.options.map((o) => (
                  <label
                    key={o.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                      selectedAnswers[q.id] === o.id
                        ? "border-leaf bg-leaf-soft"
                        : "border-rule hover:bg-paper"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      checked={selectedAnswers[q.id] === o.id}
                      onChange={() => selectOption(q.id, o.id)}
                    />
                    {o.text}
                  </label>
                ))}
              </div>
            )}

            {q.type === "fill_blank" && (
              <input
                value={textAnswers[q.id] ?? ""}
                onChange={(e) => setTextAnswer(q.id, e.target.value)}
                placeholder="Your answer"
                className="w-full rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
              />
            )}

            {q.type === "essay" && (
              <textarea
                value={textAnswers[q.id] ?? ""}
                onChange={(e) => setTextAnswer(q.id, e.target.value)}
                placeholder="Write your answer…"
                rows={5}
                className="w-full rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
              />
            )}

            {q.type === "matching" && (
              <div className="space-y-2">
                {q.options.map((o) => (
                  <div key={o.id} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 rounded-lg border border-rule bg-paper px-3 py-2">
                      {o.matchPrompt}
                    </span>
                    <span className="text-ink-soft">→</span>
                    <select
                      value={matchedAnswers[q.id]?.[o.id] ?? ""}
                      onChange={(e) => setMatchAnswer(q.id, o.id, e.target.value)}
                      className="flex-1 rounded-lg border border-rule px-3 py-2"
                    >
                      <option value="" disabled>
                        Choose a match…
                      </option>
                      {[...q.options]
                        .map((opt) => opt.text)
                        .sort((a, b) => a.localeCompare(b))
                        .map((text) => (
                          <option key={text} value={text}>
                            {text}
                          </option>
                        ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
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
