import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { QuizBuilder, type QuestionDraft, type QuestionType } from "@/components/QuizBuilder";

/**
 * Edit a quiz's questions. Allowed only while the quiz is unpublished and
 * has no attempts -- recorded answers reference question/option ids, so
 * changing questions under them would corrupt students' scores. The server
 * action and database function enforce the same rules; this page just
 * explains them instead of showing a form that would be rejected.
 */
export default async function EditQuizQuestionsPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  const supabase = createClient();

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id, is_published, assessments(title)")
    .eq("id", quizId)
    .maybeSingle();

  const backHref = `/dashboard/teacher/quizzes/${quizId}`;
  const back = (
    <Link href={backHref} className="mb-4 inline-block text-sm text-leaf hover:underline">
      ← Back to quiz
    </Link>
  );

  if (!quiz) {
    return (
      <div className="max-w-lg">
        {back}
        <p className="text-sm text-clay">Quiz not found.</p>
      </div>
    );
  }

  const { count: attemptCount } = await supabase
    .from("quiz_attempts")
    .select("id", { count: "exact", head: true })
    .eq("quiz_id", quizId);

  if (quiz.is_published || attemptCount) {
    return (
      <div className="max-w-lg">
        {back}
        <h1 className="mb-2 font-display text-2xl font-semibold text-ink">Edit questions</h1>
        <p className="rounded-xl border border-rule bg-white p-4 text-sm text-ink-soft">
          {attemptCount
            ? `${attemptCount} student attempt${attemptCount === 1 ? "" : "s"} already exist, so this quiz's questions can't be changed without altering scores that are already recorded.`
            : "Unpublish this quiz first, then you can edit its questions."}
        </p>
      </div>
    );
  }

  const { data: questions } = await supabase
    .from("quiz_questions")
    .select(
      "id, question_text, question_type, points, sequence_order, quiz_options(option_text, match_prompt, is_correct, sequence_order)"
    )
    .eq("quiz_id", quizId)
    .order("sequence_order", { ascending: true });

  const drafts: QuestionDraft[] = (questions ?? []).map((q) => ({
    questionText: q.question_text,
    questionType: q.question_type as QuestionType,
    points: Number(q.points),
    options: [...(q.quiz_options ?? [])]
      .sort((a, b) => a.sequence_order - b.sequence_order)
      .map((o) => ({
        text: o.option_text,
        isCorrect: o.is_correct,
        matchPrompt: o.match_prompt ?? undefined,
      })),
  }));

  return (
    <div className="max-w-2xl">
      {back}
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">Edit questions</h1>
      <p className="mb-6 text-sm text-ink-soft">
        Saving replaces all of this quiz&apos;s questions and updates its total points.
      </p>
      <QuizBuilder
        editQuiz={{
          quizId,
          title: quiz.assessments?.title ?? "this quiz",
          questions: drafts,
        }}
      />
    </div>
  );
}
