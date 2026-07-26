import { createClient } from "@/lib/supabase/server";
import { PublishToggle } from "@/components/PublishToggle";

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
      "id, is_published, duration_minutes, opens_at, closes_at, assessments(title, max_score, term, academic_year, classes(name, arm))"
    )
    .eq("id", quizId)
    .single();

  const { data: questions } = await supabase
    .from("quiz_questions")
    .select(
      "id, question_text, points, sequence_order, quiz_options(id, option_text, is_correct, sequence_order)"
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
          </p>
        </div>
        <PublishToggle quizId={quiz.id} isPublished={quiz.is_published} />
      </div>

      <div className="mb-6 rounded-xl border border-rule bg-white p-4 text-sm text-ink-soft">
        Scores are submitted with moderation status{" "}
        <span className="font-medium text-ink">pending</span> — approve them from Grade Moderation
        like any other assessment.
      </div>

      <div className="mb-6">
        <h2 className="mb-2 font-display text-lg font-semibold text-ink">Questions</h2>
        <div className="space-y-3">
          {(questions ?? []).map((q, i) => (
            <div key={q.id} className="rounded-lg border border-rule bg-white p-3">
              <p className="mb-2 text-sm font-medium text-ink">
                {i + 1}. {q.question_text} <span className="text-ink-soft">({q.points} pts)</span>
              </p>
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
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 font-display text-lg font-semibold text-ink">Attempts</h2>
        <div className="space-y-2">
          {(attempts ?? []).map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between rounded-lg border border-rule bg-white p-3 text-sm"
            >
              <div>
                <p className="font-medium text-ink">{a.student_profiles?.profiles?.full_name}</p>
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
          ))}
          {!attempts?.length && <p className="text-sm text-ink-soft">No attempts yet.</p>}
        </div>
      </div>
    </div>
  );
}
