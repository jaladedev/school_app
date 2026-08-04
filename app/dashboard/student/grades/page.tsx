import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";

export default async function StudentGradesPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }
  const supabase = createClient();

  const { data: grades } = await supabase
    .from("grades")
    .select("*, assessments(title, max_score, term, academic_year, subjects(name))")
    .eq("student_id", profile.id)
    .order("graded_at", { ascending: false });

  // A grade row for a quiz is inserted the moment the student submits, with
  // essay questions scored as 0 -- it only becomes a real final score once
  // a teacher grades those essays (grade_quiz_essay_answers). Find which
  // grade rows are still linked to an attempt with an ungraded essay
  // answer so the number itself can be hidden until then.
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
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">My grades</h1>
      <p className="mb-6 text-sm text-ink-soft">
        Scores from assessments across all your subjects.
      </p>

      {[...bySubject.entries()].map(([subjectName, subjectGrades]) => (
        <div key={subjectName} className="mb-8">
          <h2 className="mb-3 font-display text-lg font-semibold text-ink">{subjectName}</h2>
          <div className="space-y-2">
            {subjectGrades?.map((g: any) => (
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
                    <span className="text-sm font-medium text-marigold-text">Awaiting grading</span>
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

      {!grades?.length && <EmptyState message="No grades recorded yet." />}
    </div>
  );
}
