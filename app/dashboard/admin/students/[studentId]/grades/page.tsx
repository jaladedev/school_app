import { createClient } from "@/lib/supabase/server";
import { StudentDetailTabs } from "@/components/StudentDetailTabs";

export default async function StudentGradesTabPage({
  params,
}: {
  params: { studentId: string };
}) {
  const supabase = createClient();

  const { data: grades } = await supabase
    .from("grades")
    .select("*, assessments(title, max_score, term, academic_year, subjects(name))")
    .eq("student_id", params.studentId)
    .order("graded_at", { ascending: false });

  const bySubject = new Map<string, typeof grades>();
  for (const g of grades ?? []) {
    const subjectName = (g as any).assessments?.subjects?.name ?? "Unknown subject";
    bySubject.set(subjectName, [...(bySubject.get(subjectName) ?? []), g]);
  }

  return (
    <div>
      <StudentDetailTabs studentId={params.studentId} />

      <h1 className="mb-6 font-display text-2xl font-semibold text-ink">Grades</h1>

      {[...bySubject.entries()].map(([subjectName, subjectGrades]) => (
        <div key={subjectName} className="mb-6">
          <h2 className="mb-2 font-display text-lg font-semibold text-ink">{subjectName}</h2>
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
                  {g.score} / {g.assessments?.max_score}
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