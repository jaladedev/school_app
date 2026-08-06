import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { getQuizQuestionAnalytics } from "@/lib/actions/quiz";
import { QuizQuestionAnalytics } from "@/components/QuizQuestionAnalytics";

export default async function TeacherQuizAnalyticsPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  const supabase = createClient();

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id, assessments(title, classes(name, arm))")
    .eq("id", quizId)
    .single();

  if (!quiz) {
    return (
      <div className="max-w-lg">
        <p className="text-sm text-clay">Quiz not found.</p>
      </div>
    );
  }

  const { totalSubmitted, questions } = await getQuizQuestionAnalytics(quizId);

  return (
    <div className="max-w-2xl">
      <Link
        href={`/dashboard/teacher/quizzes/${quiz.id}`}
        className="mb-4 inline-block text-sm text-ink-soft hover:text-ink"
      >
        ← Back to quiz
      </Link>

      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">
          {quiz.assessments?.title} · Analytics
        </h1>
        <p className="text-sm text-ink-soft">
          {quiz.assessments?.classes?.name} {quiz.assessments?.classes?.arm} · {totalSubmitted}{" "}
          submitted attempt{totalSubmitted === 1 ? "" : "s"}
        </p>
      </div>

      <QuizQuestionAnalytics totalSubmitted={totalSubmitted} questions={questions} />
    </div>
  );
}
