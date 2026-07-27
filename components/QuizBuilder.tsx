"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createQuiz } from "@/lib/actions/quiz";
import { emitToast } from "@/lib/toast";

type QuestionType = "mcq" | "true_false";
type OptionDraft = { text: string; isCorrect: boolean };
type QuestionDraft = {
  questionText: string;
  questionType: QuestionType;
  points: number;
  options: OptionDraft[];
};

function blankQuestion(): QuestionDraft {
  return {
    questionText: "",
    questionType: "mcq",
    points: 1,
    options: [
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
    ],
  };
}

export function QuizBuilder({
  subjects,
  classes,
  academicYear,
  term,
}: {
  subjects: { id: string; name: string }[];
  classes: { id: string; label: string }[];
  academicYear: string;
  term: number;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [durationMinutes, setDurationMinutes] = useState("20");
  const [questions, setQuestions] = useState<QuestionDraft[]>([blankQuestion()]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function updateQuestion(index: number, patch: Partial<QuestionDraft>) {
    setQuestions((qs) => qs.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }

  function setQuestionType(index: number, type: QuestionType) {
    setQuestions((qs) =>
      qs.map((q, i) =>
        i === index
          ? {
              ...q,
              questionType: type,
              options:
                type === "true_false"
                  ? [
                      { text: "True", isCorrect: true },
                      { text: "False", isCorrect: false },
                    ]
                  : [
                      { text: "", isCorrect: false },
                      { text: "", isCorrect: false },
                    ],
            }
          : q
      )
    );
  }

  function updateOption(qIndex: number, oIndex: number, patch: Partial<OptionDraft>) {
    setQuestions((qs) =>
      qs.map((q, i) =>
        i === qIndex
          ? {
              ...q,
              options: q.options.map((o, j) => (j === oIndex ? { ...o, ...patch } : o)),
            }
          : q
      )
    );
  }

  function markCorrect(qIndex: number, oIndex: number) {
    setQuestions((qs) =>
      qs.map((q, i) =>
        i === qIndex
          ? { ...q, options: q.options.map((o, j) => ({ ...o, isCorrect: j === oIndex })) }
          : q
      )
    );
  }

  function addOption(qIndex: number) {
    setQuestions((qs) =>
      qs.map((q, i) =>
        i === qIndex ? { ...q, options: [...q.options, { text: "", isCorrect: false }] } : q
      )
    );
  }

  function removeOption(qIndex: number, oIndex: number) {
    setQuestions((qs) =>
      qs.map((q, i) =>
        i === qIndex ? { ...q, options: q.options.filter((_, j) => j !== oIndex) } : q
      )
    );
  }

  function addQuestion() {
    setQuestions((qs) => [...qs, blankQuestion()]);
  }

  function removeQuestion(index: number) {
    setQuestions((qs) => qs.filter((_, i) => i !== index));
  }

  const totalPoints = questions.reduce((sum, q) => sum + (Number(q.points) || 0), 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) return setError("Title is required.");
    if (!subjectId || !classId) return setError("Pick a subject and class.");

    startTransition(async () => {
      try {
        const quizId = await createQuiz({
          title,
          subjectId,
          classId,
          term,
          academicYear,
          durationMinutes: Number(durationMinutes),
          questions: questions.map((q) => ({
            questionText: q.questionText,
            questionType: q.questionType,
            points: Number(q.points) || 1,
            options: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
          })),
        });
        emitToast("Quiz created — publish it when you're ready.");
        router.push(`/dashboard/teacher/quizzes/${quizId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <div className="grid grid-cols-2 gap-3 rounded-xl border border-rule bg-white p-4">
        <input
          required
          placeholder="Quiz title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="col-span-2 rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
        />
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
              {c.label}
            </option>
          ))}
        </select>
        <label className="col-span-2 flex items-center gap-2 text-sm text-ink-soft">
          Duration (minutes)
          <input
            type="number"
            min={1}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
            className="w-24 rounded-lg border border-rule px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className="space-y-4">
        {questions.map((q, qIndex) => (
          <div key={qIndex} className="rounded-xl border border-rule bg-white p-4">
            <div className="mb-3 flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-ink">Question {qIndex + 1}</p>
              {questions.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeQuestion(qIndex)}
                  className="text-xs text-clay hover:underline"
                >
                  Remove
                </button>
              )}
            </div>

            <textarea
              required
              placeholder="Question text — use $...$ for inline math, e.g. $x^2 + 3x - 4 = 0$"
              value={q.questionText}
              onChange={(e) => updateQuestion(qIndex, { questionText: e.target.value })}
              rows={2}
              className="mb-3 w-full rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
            />

            <div className="mb-3 flex flex-wrap items-center gap-3">
              <select
                value={q.questionType}
                onChange={(e) => setQuestionType(qIndex, e.target.value as QuestionType)}
                className="rounded-lg border border-rule px-3 py-2 text-sm"
              >
                <option value="mcq">Multiple choice</option>
                <option value="true_false">True / False</option>
              </select>
              <label className="flex items-center gap-2 text-sm text-ink-soft">
                Points
                <input
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={q.points}
                  onChange={(e) => updateQuestion(qIndex, { points: Number(e.target.value) })}
                  className="w-16 rounded-lg border border-rule px-2 py-1 text-sm"
                />
              </label>
            </div>

            <div className="space-y-2">
              {q.options.map((o, oIndex) => (
                <div key={oIndex} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${qIndex}`}
                    checked={o.isCorrect}
                    onChange={() => markCorrect(qIndex, oIndex)}
                    aria-label="Correct answer"
                  />
                  <input
                    required
                    disabled={q.questionType === "true_false"}
                    placeholder={`Option ${oIndex + 1}`}
                    value={o.text}
                    onChange={(e) => updateOption(qIndex, oIndex, { text: e.target.value })}
                    className="flex-1 rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold disabled:bg-paper"
                  />
                  {q.questionType === "mcq" && q.options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(qIndex, oIndex)}
                      className="text-xs text-clay hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              {q.questionType === "mcq" && (
                <button
                  type="button"
                  onClick={() => addOption(qIndex)}
                  className="text-xs text-leaf hover:underline"
                >
                  + Add option
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={addQuestion}
          className="rounded-lg border border-rule px-3 py-2 text-sm font-medium text-ink hover:bg-leaf-soft"
        >
          + Add question
        </button>
        <p className="text-sm text-ink-soft">
          Total: {totalPoints} point{totalPoints === 1 ? "" : "s"}
        </p>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-leaf px-4 py-2 text-sm font-medium text-white hover:bg-leaf/90 disabled:opacity-60"
      >
        {isPending ? "Creating…" : "Create quiz"}
      </button>

      {error && <p className="text-sm text-clay">{error}</p>}
    </form>
  );
}
