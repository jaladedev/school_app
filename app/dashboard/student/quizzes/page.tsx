import Link from "next/link";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { EmptyState } from "@/components/EmptyState";

export default async function StudentQuizzesPage() {
  const profile = await getCurrentProfile();
  const supabase = createClient();

  // RLS already restricts this to published quizzes for the student's own
  // class — no extra filtering needed here.
  const { data: quizzes } = await supabase
    .from("quizzes")
    .select("id, duration_minutes, closes_at, assessments(title, max_score)")
    .order("created_at", { ascending: false });

  const { data: attempts } = profile
    ? await supabase
        .from("quiz_attempts")
        .select("id, quiz_id, submitted_at, score, total_points")
        .eq("student_id", profile.id)
    : { data: [] };

  const attemptByQuiz = new Map((attempts ?? []).map((a) => [a.quiz_id, a]));

  // Essay questions score 0 at submit time and only get real points once a
  // teacher grades them (grade_quiz_essay_answers) -- until then, `score`
  // on the attempt row is a misleadingly low partial total, not a final
  // grade. Find which submitted attempts still have an ungraded essay
  // answer so we can hide the score for those instead of showing it early.
  const submittedAttemptIds = (attempts ?? []).filter((a) => a.submitted_at).map((a) => a.id);

  const { data: pendingEssayAnswers } = submittedAttemptIds.length
    ? await supabase
        .from("quiz_answers")
        .select("attempt_id, quiz_questions!inner(question_type)")
        .in("attempt_id", submittedAttemptIds)
        .eq("quiz_questions.question_type", "essay")
        .is("points_awarded", null)
    : { data: [] };

  const pendingGradingAttemptIds = new Set(
    (pendingEssayAnswers ?? []).map((row) => row.attempt_id)
  );

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">Quizzes</h1>
      <p className="mb-6 text-sm text-ink-soft">Timed quizzes available for your class.</p>

      <div className="space-y-2">
        {(quizzes ?? []).map((q) => {
          const attempt = attemptByQuiz.get(q.id);
          const submitted = !!attempt?.submitted_at;
          const closed = q.closes_at ? new Date(q.closes_at) < new Date() : false;

          return (
            <div
              key={q.id}
              className="flex items-center justify-between rounded-lg border border-rule bg-white p-3"
            >
              <div>
                <p className="text-sm font-medium text-ink">{q.assessments?.title}</p>
                <p className="text-xs text-ink-soft">
                  {q.duration_minutes} min · {q.assessments?.max_score} points
                </p>
              </div>
              {submitted ? (
                pendingGradingAttemptIds.has(attempt!.id) ? (
                  <span className="rounded-full bg-marigold/15 px-2.5 py-1 text-xs font-medium text-marigold-dark">
                    Submitted — awaiting grading
                  </span>
                ) : (
                  <span className="rounded-full bg-leaf-soft px-2.5 py-1 text-xs font-medium text-leaf">
                    Submitted — {attempt!.score}/{attempt!.total_points}
                  </span>
                )
              ) : closed ? (
                <span className="rounded-full bg-clay/10 px-2.5 py-1 text-xs font-medium text-clay">
                  Closed
                </span>
              ) : (
                <Link
                  href={`/dashboard/student/quizzes/${q.id}/attempt`}
                  className="rounded-lg bg-leaf px-3 py-1.5 text-sm font-medium text-white hover:bg-leaf/90"
                >
                  {attempt ? "Continue" : "Start"}
                </Link>
              )}
            </div>
          );
        })}
        {!quizzes?.length && <EmptyState message="No quizzes available right now." />}
      </div>
    </div>
  );
}
