import { createClient } from "@/lib/supabase/server";
import { QuizAttemptRunner } from "@/components/QuizAttemptRunner";

export default async function QuizAttemptPage({ params }: { params: Promise<{ quizId: string }> }) {
  const { quizId } = await params;
  const supabase = createClient();

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id, duration_minutes, assessments(title)")
    .eq("id", quizId)
    .single();

  if (!quiz) {
    return (
      <div className="max-w-lg">
        <p className="text-sm text-clay">
          This quiz isn&apos;t available — it may not be published yet, or may not be open to your class.
        </p>
      </div>
    );
  }

  return (
    <QuizAttemptRunner
      quizId={quiz.id}
      quizTitle={quiz.assessments?.title ?? "Quiz"}
      durationMinutes={quiz.duration_minutes}
    />
  );
}
