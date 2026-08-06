import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { PublishToggle } from "@/components/PublishToggle";
import { QuestionText } from "@/components/QuestionText";
import { EssayGradingForm } from "@/components/EssayGradingForm";

export default async function TeacherQuizDetailPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  const supabase = createClient();

  const { data: quiz } = await supabase
    .from("quizzes")
    .select(
      "id, is_published, duration_minutes, opens_at, closes_at, shuffle_questions, assessments(title, max_score, term, academic_year, classes(name, arm))"
    )
    .eq("id", quizId)
    .single();

  const { data: questions } = await supabase
    .from("quiz_questions")
    .select(
      "id, question_text, question_type, points, sequence_order, quiz_options(id, option_text, match_prompt, is_correct, sequence_order)"
    )
    .eq("quiz_id", quizId)
    .order("sequence_order", { ascending: true });

  const { data: attempts } = await supabase
    .from("quiz_attempts")
    .select(
      "id, submitted_at, score, total_points, student_profiles(admission_no, profiles(full_name)), grades(moderation_status)"
    )
    .eq("quiz_id", quizId)
    .order("submitted_at", { ascending: false, nullsFirst: false });

  const essayQuestions = (questions ?? []).filter((q) => q.question_type === "essay");
  const submittedAttemptIds = (attempts ?? []).filter((a) => a.submitted_at).map((a) => a.id);

  // Only fetched when the quiz actually has essay questions and at least
  // one submitted attempt — most quizzes have neither, so this stays a
  // no-op in the common case.
  type EssayAnswerRow = {
    attempt_id: string;
    question_id: string;
    answer_text: string | null;
    points_awarded: number | null;
  };

  const { data: essayAnswers } =
    essayQuestions.length && submittedAttemptIds.length
      ? await supabase
          .from("quiz_answers")
          .select("attempt_id, question_id, answer_text, points_awarded")
          .in("attempt_id", submittedAttemptIds)
          .in(
            "question_id",
            essayQuestions.map((q) => q.id)
          )
      : { data: [] as EssayAnswerRow[] };

  const essayAnswersByAttempt = new Map<string, typeof essayAnswers>();
  for (const row of essayAnswers ?? []) {
    if (!essayAnswersByAttempt.has(row.attempt_id)) essayAnswersByAttempt.set(row.attempt_id, []);
    essayAnswersByAttempt.get(row.attempt_id)!.push(row);
  }

  if (!quiz) {
    return (
      <div className="max-w-lg">
        <p className="text-sm text-clay">Quiz not found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">
            {quiz.assessments?.title}
          </h1>
          <p className="text-sm text-ink-soft">
            {quiz.assessments?.classes?.name} {quiz.assessments?.classes?.arm} ·{" "}
            {quiz.duration_minutes} min · {quiz.assessments?.max_score} points total
            {quiz.shuffle_questions && " · shuffled per student"}
          </p>
        </div>
        <PublishToggle quizId={quiz.id} isPublished={quiz.is_published} />
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href={`/dashboard/teacher/quizzes/${quiz.id}/preview`}
          className="inline-block rounded-lg border border-rule px-3 py-2 text-sm font-medium text-ink hover:bg-paper"
        >
          Preview / dry-run this quiz
        </Link>
        <Link
          href={`/dashboard/teacher/quizzes/${quiz.id}/analytics`}
          className="inline-block rounded-lg border border-rule px-3 py-2 text-sm font-medium text-ink hover:bg-paper"
        >
          View analytics
        </Link>
      </div>

      <div className="mb-6 rounded-xl border border-rule bg-white p-4 text-sm text-ink-soft">
        Scores are submitted with moderation status{" "}
        <span className="font-medium text-ink">pending</span> — approve them from Grade Moderation
        like any other assessment.
        {essayQuestions.length > 0 && (
          <> Essay questions don&apos;t auto-score — grade them below on each attempt first.</>
        )}
      </div>

      <div className="mb-6">
        <h2 className="mb-2 font-display text-lg font-semibold text-ink">Questions</h2>
        <div className="space-y-3">
          {(questions ?? []).map((q, i) => (
            <div key={q.id} className="rounded-lg border border-rule bg-white p-3">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-ink-soft">
                  Question {i + 1} · {q.question_type.replace("_", " ")}
                </span>
                <span className="text-xs text-ink-soft">{q.points} pts</span>
              </div>
              <QuestionText text={q.question_text} className="mb-2" />

              {q.question_type === "essay" && (
                <p className="text-xs italic text-ink-soft">Free-text answer, graded manually.</p>
              )}

              {q.question_type === "fill_blank" && (
                <p className="text-sm text-ink-soft">
                  Accepted:{" "}
                  {(q.quiz_options ?? [])
                    .sort((a, b) => a.sequence_order - b.sequence_order)
                    .map((o) => o.option_text)
                    .join(", ")}
                </p>
              )}

              {q.question_type === "matching" && (
                <ul className="space-y-1 text-sm">
                  {(q.quiz_options ?? [])
                    .sort((a, b) => a.sequence_order - b.sequence_order)
                    .map((o) => (
                      <li key={o.id} className="text-ink-soft">
                        {o.match_prompt} →{" "}
                        <span className="font-medium text-ink">{o.option_text}</span>
                      </li>
                    ))}
                </ul>
              )}

              {(q.question_type === "mcq" || q.question_type === "true_false") && (
                <ul className="space-y-1 text-sm">
                  {(q.quiz_options ?? [])
                    .sort((a, b) => a.sequence_order - b.sequence_order)
                    .map((o) => (
                      <li
                        key={o.id}
                        className={o.is_correct ? "font-medium text-leaf" : "text-ink-soft"}
                      >
                        {o.is_correct ? "✓ " : "· "}
                        {o.option_text}
                      </li>
                    ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 font-display text-lg font-semibold text-ink">Attempts</h2>
        <div className="space-y-2">
          {(attempts ?? []).map((a) => {
            const attemptEssayAnswers = (essayAnswersByAttempt.get(a.id) ?? []).map((row) => {
              const question = essayQuestions.find((q) => q.id === row.question_id)!;
              return {
                questionId: row.question_id,
                questionText: question.question_text,
                points: question.points,
                answerText: row.answer_text,
                pointsAwarded: row.points_awarded,
              };
            });
            // A submitted attempt may not have an answer_text row yet for
            // every essay question (student left it blank) — still show
            // those so the teacher can see it was skipped, not omit them.
            const missingEssayAnswers = a.submitted_at
              ? essayQuestions
                  .filter((q) => !attemptEssayAnswers.some((ea) => ea.questionId === q.id))
                  .map((q) => ({
                    questionId: q.id,
                    questionText: q.question_text,
                    points: q.points,
                    answerText: null,
                    pointsAwarded: null,
                  }))
              : [];

            return (
              <div key={a.id} className="rounded-lg border border-rule bg-white p-3 text-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-ink">
                      {a.student_profiles?.profiles?.full_name}
                    </p>
                    <p className="text-xs text-ink-soft">{a.student_profiles?.admission_no}</p>
                  </div>
                  <div className="text-right">
                    {a.submitted_at ? (
                      <>
                        <p className="font-medium text-ink">
                          {a.score}/{a.total_points}
                        </p>
                        <p className="text-xs capitalize text-ink-soft">
                          {a.grades?.moderation_status ?? "pending"}
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-ink-soft">In progress</p>
                    )}
                  </div>
                </div>
                {a.submitted_at && (
                  <EssayGradingForm
                    quizId={quiz.id}
                    attemptId={a.id}
                    essayAnswers={[...attemptEssayAnswers, ...missingEssayAnswers]}
                  />
                )}
              </div>
            );
          })}
          {!attempts?.length && <p className="text-sm text-ink-soft">No attempts yet.</p>}
        </div>
      </div>
    </div>
  );
}
