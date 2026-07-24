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
