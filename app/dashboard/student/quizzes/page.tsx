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
        .select("id, quiz_id, submitted_at, score, total_points, grade_id")
        .eq("student_id", profile.id)
    : { data: [] };

  // Essay questions don't get scored at submit time (submit_quiz_attempt
  // deliberately leaves them at 0 -- see the quiz_question_types
  // migration) -- a teacher grades them afterward via
  // grade_quiz_essay_answers, which sets quiz_answers.points_awarded and
  // updates quiz_attempts.score. Until that happens, the score already on
  // the attempt understates the real total, so showing it plainly as
  // "Submitted — 3/10" would read as final when it isn't. Flag any
  // attempt with at least one essay answer still awaiting a score so we
  // can show that instead; once points_awarded is set, this list is
  // empty for that attempt and the badge below reverts to the real score
  // on the student's next visit (RLS already scopes this to the
  // student's own attempts, same as quiz_attempts_select).
  const { data: pendingEssays } = profile
    ? await supabase
        .from("quiz_answers")
        .select("attempt_id, quiz_questions!inner(question_type)")
        .eq("quiz_questions.question_type", "essay")
        .is("points_awarded", null)
    : { data: [] };
  const attemptsPendingGrading = new Set((pendingEssays ?? []).map((r) => r.attempt_id));

  const gradeIds = (attempts ?? []).map((a) => a.grade_id).filter((id): id is string => !!id);
  const { data: grades } = gradeIds.length
    ? await supabase.from("grades").select("id, moderation_status").in("id", gradeIds)
    : { data: [] };
  const approvedGradeIds = new Set(
    (grades ?? []).filter((g) => g.moderation_status === "approved").map((g) => g.id)
  );

  const attemptByQuiz = new Map((attempts ?? []).map((a) => [a.quiz_id, a]));

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">Quizzes</h1>
      <p className="mb-6 text-sm text-ink-soft">Timed quizzes available for your class.</p>

      <div className="space-y-2">
        {(quizzes ?? []).map((q) => {
          const attempt = attemptByQuiz.get(q.id);
          const submitted = !!attempt?.submitted_at;
          const pendingGrading = !!attempt && attemptsPendingGrading.has(attempt.id);
          const pendingApproval =
            !!attempt && !pendingGrading && !approvedGradeIds.has(attempt.grade_id ?? "");
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
                pendingGrading ? (
                  <span
                    title="This quiz includes essay questions your teacher hasn't scored yet — your final score will update once grading is complete."
                    className="rounded-full bg-marigold/20 px-2.5 py-1 text-xs font-medium text-ink"
                  >
                    Submitted — grading in progress
                  </span>
                ) : pendingApproval ? (
                  <span
                    title="Your score is computed but hasn't been approved yet — it'll appear here and on your grades page once that's done."
                    className="rounded-full bg-marigold/20 px-2.5 py-1 text-xs font-medium text-ink"
                  >
                    Submitted — pending approval
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
