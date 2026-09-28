import Link from "next/link";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { QuestionText } from "@/components/QuestionText";
import type { QuizAttemptReviewRow, QuestionType } from "@/types/database";

type ReviewOption = {
  id: string;
  text: string;
  isCorrect: boolean;
  matchPrompt: string | null;
};

type ReviewQuestion = {
  id: string;
  text: string;
  type: QuestionType;
  points: number;
  options: ReviewOption[];
  selectedOptionId: string | null;
  answerText: string | null;
  matchedPairs: Record<string, string> | null;
  pointsAwarded: number | null;
};

function groupReview(rows: QuizAttemptReviewRow[]): ReviewQuestion[] {
  const byId = new Map<string, ReviewQuestion>();

  for (const r of rows) {
    if (!byId.has(r.question_id)) {
      byId.set(r.question_id, {
        id: r.question_id,
        text: r.question_text,
        type: r.question_type as QuestionType,
        points: r.points,
        options: [],
        selectedOptionId: r.selected_option_id,
        answerText: r.answer_text,
        matchedPairs: r.matched_pairs,
        pointsAwarded: r.points_awarded,
      });
    }
    if (r.option_id) {
      byId.get(r.question_id)!.options.push({
        id: r.option_id,
        text: r.option_text ?? "",
        isCorrect: !!r.is_correct,
        matchPrompt: r.match_prompt,
      });
    }
  }

  return [...byId.values()];
}

// Mirrors submit_quiz_attempt's per-type scoring exactly (case-
// insensitive/trimmed compares, matching all-or-nothing) so the
// correct/incorrect badge shown here always agrees with the score the
// student was actually given.
function questionOutcome(
  q: ReviewQuestion
): "correct" | "incorrect" | "partial" | "pending" | "unanswered" {
  if (q.type === "mcq" || q.type === "true_false") {
    if (!q.selectedOptionId) return "unanswered";
    const chosen = q.options.find((o) => o.id === q.selectedOptionId);
    return chosen?.isCorrect ? "correct" : "incorrect";
  }
  if (q.type === "fill_blank") {
    if (!q.answerText) return "unanswered";
    const normalized = q.answerText.trim().toLowerCase();
    const accepted = q.options.some(
      (o) => o.isCorrect && o.text.trim().toLowerCase() === normalized
    );
    return accepted ? "correct" : "incorrect";
  }
  if (q.type === "matching") {
    if (!q.matchedPairs) return "unanswered";
    const allMatched = q.options.every(
      (o) => (q.matchedPairs?.[o.id] ?? "").trim().toLowerCase() === o.text.trim().toLowerCase()
    );
    return allMatched ? "correct" : "incorrect";
  }
  // essay
  if (!q.answerText) return "unanswered";
  if (q.pointsAwarded === null) return "pending";
  if (q.pointsAwarded >= q.points) return "correct";
  if (q.pointsAwarded > 0) return "partial";
  return "incorrect";
}

const OUTCOME_STYLE: Record<string, string> = {
  correct: "bg-leaf-soft text-leaf",
  partial: "bg-marigold/20 text-marigold-text",
  incorrect: "bg-clay/10 text-clay",
  pending: "bg-marigold/20 text-ink",
  unanswered: "bg-paper text-ink-soft",
};

const OUTCOME_LABEL: Record<string, string> = {
  correct: "Correct",
  partial: "Partial credit",
  incorrect: "Incorrect",
  pending: "Awaiting grading",
  unanswered: "Not answered",
};

export default async function QuizAttemptReviewPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }
  const supabase = createClient();

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id, assessments(title, max_score)")
    .eq("id", quizId)
    .single();

  const { data: attempt } = await supabase
    .from("quiz_attempts")
    .select("id, submitted_at, score, total_points")
    .eq("quiz_id", quizId)
    .eq("student_id", profile.id)
    .maybeSingle();

  if (!quiz || !attempt || !attempt.submitted_at) {
    return (
      <div className="max-w-2xl">
        <p className="text-sm text-clay">
          There&apos;s nothing to review here yet — submit the quiz first.
        </p>
        <Link
          href="/dashboard/student/quizzes"
          className="mt-3 inline-block text-sm text-leaf hover:underline"
        >
          Back to quizzes
        </Link>
      </div>
    );
  }

  const { data: rows, error } = await supabase.rpc("get_quiz_attempt_review", {
    p_attempt_id: attempt.id,
  });

  if (error || !rows) {
    return (
      <div className="max-w-2xl">
        <p className="text-sm text-clay">Couldn&apos;t load your answers right now.</p>
      </div>
    );
  }

  const questions = groupReview(rows as QuizAttemptReviewRow[]).sort((a, b) => {
    const seqA = rows.find((r) => r.question_id === a.id)?.question_sequence ?? 0;
    const seqB = rows.find((r) => r.question_id === b.id)?.question_sequence ?? 0;
    return seqA - seqB;
  });

  return (
    <div className="max-w-2xl">
      <Link
        href="/dashboard/student/quizzes"
        className="mb-4 inline-block text-sm text-ink-soft hover:underline"
      >
        ← Back to quizzes
      </Link>
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">
        {quiz.assessments?.title ?? "Quiz"} — review
      </h1>
      <p className="mb-6 text-sm text-ink-soft">
        Score: {attempt.score ?? 0}/{attempt.total_points ?? quiz.assessments?.max_score}
      </p>

      <div className="space-y-4">
        {questions.map((q, i) => {
          const outcome = questionOutcome(q);

          return (
            <div key={q.id} className="rounded-lg border border-rule bg-white p-4">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="flex-1">
                  <span className="mr-1 text-xs text-ink-soft">
                    {i + 1}. ({q.points} pt{q.points === 1 ? "" : "s"})
                  </span>
                  <QuestionText text={q.text} className="inline" />
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${OUTCOME_STYLE[outcome]}`}
                >
                  {OUTCOME_LABEL[outcome]}
                </span>
              </div>

              {(q.type === "mcq" || q.type === "true_false") && (
                <div className="space-y-1">
                  {q.options.map((o) => {
                    const wasSelected = o.id === q.selectedOptionId;
                    return (
                      <div
                        key={o.id}
                        className={`rounded-lg border px-3 py-1.5 text-sm ${
                          o.isCorrect
                            ? "border-leaf/40 bg-leaf-soft text-leaf"
                            : wasSelected
                              ? "border-clay/40 bg-clay/10 text-clay"
                              : "border-rule text-ink-soft"
                        }`}
                      >
                        {o.text}
                        {wasSelected && !o.isCorrect ? " — your answer" : ""}
                        {o.isCorrect ? " — correct answer" : ""}
                      </div>
                    );
                  })}
                </div>
              )}

              {q.type === "fill_blank" && (
                <div className="space-y-1 text-sm">
                  <p className="text-ink-soft">
                    Your answer: <span className="text-ink">{q.answerText || "—"}</span>
                  </p>
                  {outcome === "incorrect" && (
                    <p className="text-leaf">
                      Accepted answer{q.options.length === 1 ? "" : "s"}:{" "}
                      {q.options.map((o) => o.text).join(", ")}
                    </p>
                  )}
                </div>
              )}

              {q.type === "matching" && (
                <div className="space-y-1 text-sm">
                  {q.options.map((o) => {
                    const chosen = q.matchedPairs?.[o.id] ?? "";
                    const rowCorrect = chosen.trim().toLowerCase() === o.text.trim().toLowerCase();
                    return (
                      <div
                        key={o.id}
                        className={`rounded-lg border px-3 py-1.5 ${
                          rowCorrect ? "border-leaf/40 bg-leaf-soft" : "border-clay/40 bg-clay/10"
                        }`}
                      >
                        <span className="text-ink-soft">{o.matchPrompt}:</span>{" "}
                        <span className={rowCorrect ? "text-leaf" : "text-clay"}>
                          {chosen || "—"}
                        </span>
                        {!rowCorrect && <span className="text-leaf"> (correct: {o.text})</span>}
                      </div>
                    );
                  })}
                </div>
              )}

              {q.type === "essay" && (
                <div className="space-y-1 text-sm">
                  <p className="whitespace-pre-wrap text-ink">{q.answerText || "—"}</p>
                  {q.pointsAwarded !== null && (
                    <p className="text-ink-soft">
                      Points awarded: {q.pointsAwarded}/{q.points}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
