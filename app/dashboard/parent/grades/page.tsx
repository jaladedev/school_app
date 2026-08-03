import { createClient } from "@/lib/supabase/server";
import { getLinkedChildren, resolveSelectedChild } from "@/lib/parent";
import { ChildSwitcher } from "@/components/ChildSwitcher";

export default async function ParentGradesPage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string }>;
}) {
  const resolvedSearchParams = await searchParams;

  const children = await getLinkedChildren();
  const selected = await resolveSelectedChild(resolvedSearchParams.child);

  if (!selected) {
    return <p className="text-sm text-ink-soft">No children linked to your account.</p>;
  }

  const supabase = createClient();

  const { data: grades } = await supabase
    .from("grades")
    .select("*, assessments(title, max_score, term, academic_year, subjects(name))")
    .eq("student_id", selected.id)
    .order("graded_at", { ascending: false });

  // Same as the student grades page: a quiz's grade row exists as soon as
  // the student submits, with essay questions scored 0 until a teacher
  // grades them. Hide the number for grades still tied to that state.
  const gradeIds = (grades ?? []).map((g) => g.id);
  const { data: linkedAttempts } = gradeIds.length
    ? await supabase.from("quiz_attempts").select("id, grade_id").in("grade_id", gradeIds)
    : { data: [] };
  const attemptIdToGradeId = new Map((linkedAttempts ?? []).map((a) => [a.id, a.grade_id]));
  const linkedAttemptIds = (linkedAttempts ?? []).map((a) => a.id);

  const { data: pendingEssayAnswers } = linkedAttemptIds.length
    ? await supabase
        .from("quiz_answers")
        .select("attempt_id, quiz_questions!inner(question_type)")
        .in("attempt_id", linkedAttemptIds)
        .eq("quiz_questions.question_type", "essay")
        .is("points_awarded", null)
    : { data: [] };

  const pendingGradeIds = new Set(
    (pendingEssayAnswers ?? [])
      .map((row) => attemptIdToGradeId.get(row.attempt_id))
      .filter((id): id is string => !!id)
  );

  const bySubject = new Map<string, typeof grades>();
  for (const g of grades ?? []) {
    const subjectName = g.assessments?.subjects?.name ?? "Unknown subject";
    bySubject.set(subjectName, [...(bySubject.get(subjectName) ?? []), g]);
  }

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">Grades</h1>
      <ChildSwitcher linkedChildren={children} selectedChildId={selected.id} />

      {[...bySubject.entries()].map(([subjectName, subjectGrades]) => (
        <div key={subjectName} className="mb-6">
          <h2 className="mb-2 font-display text-lg font-semibold text-ink">{subjectName}</h2>
          <div className="space-y-2">
            {subjectGrades?.map((g) => (
              <div
                key={g.id}
                className="flex items-center justify-between rounded-lg border border-rule bg-white px-4 py-3"
              >
                <div>
                  <p className="text-ink">{g.assessments?.title}</p>
                  <p className="text-xs text-ink-soft">
                    Term {g.assessments?.term} · {g.assessments?.academic_year}
                  </p>
                </div>
                <span className="font-display text-lg font-semibold text-leaf">
                  {pendingGradeIds.has(g.id) ? (
                    <span className="text-sm font-medium text-marigold-dark">Awaiting grading</span>
                  ) : (
                    <>
                      {g.score} / {g.assessments?.max_score}
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {!grades?.length && <p className="text-sm text-ink-soft">No grades recorded yet.</p>}
    </div>
  );
}
