import { createClient } from "@/lib/supabase/server";
import { QuizAttemptRunner } from "@/components/QuizAttemptRunner";

export default async function TeacherQuizPreviewPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  const supabase = createClient();

  // RLS's quizzes_select policy already limits this to is_admin() or
  // is_quiz_owner(id) — a teacher previewing someone else's quiz just
  // gets no row back here, same as the questions fetch inside
  // QuizAttemptRunner's preview mode.
  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id, duration_minutes, assessments(title)")
    .eq("id", quizId)
    .single();

  if (!quiz) {
    return (
      <div className="max-w-lg">
        <p className="text-sm text-clay">
          This quiz isn&apos;t available to preview — it may not exist, or you may not be its owner.
        </p>
      </div>
    );
  }

  return (
    <QuizAttemptRunner
      quizId={quiz.id}
      quizTitle={quiz.assessments?.title ?? "Quiz"}
      durationMinutes={quiz.duration_minutes}
      mode="preview"
    />
  );
}
