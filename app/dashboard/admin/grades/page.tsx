import { createClient } from "@/lib/supabase/server";
import { ApproveAssessmentButton } from "@/components/ApproveAssessmentButton";

export default async function AdminGradesModerationPage() {
  const supabase = createClient();

  const { data: assessments } = await supabase
    .from("assessments")
    .select("*, classes(name, arm), subjects(name)")
    .order("academic_year", { ascending: false })
    .order("term", { ascending: false });

  const assessmentIds = (assessments ?? []).map((a) => a.id);

  const { data: grades } = assessmentIds.length
    ? await supabase
        .from("grades")
        .select("assessment_id, moderation_status")
        .in("assessment_id", assessmentIds)
    : { data: [] };

  const statsByAssessment = new Map<string, { total: number; pending: number }>();
  for (const g of grades ?? []) {
    const stats = statsByAssessment.get(g.assessment_id) ?? { total: 0, pending: 0 };
    stats.total += 1;
    if (g.moderation_status === "pending") stats.pending += 1;
    statsByAssessment.set(g.assessment_id, stats);
  }

  const withGrades = (assessments ?? []).filter((a) => statsByAssessment.has(a.id));

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">
        Grade Moderation
      </h1>
      <p className="mb-6 text-sm text-ink-soft">
        Grades stay hidden from students until approved here.
      </p>

      <div className="space-y-2">
        {withGrades.map((a) => {
          const stats = statsByAssessment.get(a.id)!;
          return (
            <div
              key={a.id}
              className="flex items-center justify-between rounded-lg border border-rule bg-white px-4 py-3"
            >
              <div>
                <p className="font-medium text-ink">{a.title}</p>
                <p className="text-xs text-ink-soft">
                  {a.subjects?.name} · {a.classes?.name}{" "}
                  {a.classes?.arm} · Term {a.term} · {a.academic_year}
                </p>
                <p className="mt-1 text-xs text-ink-soft">
                  {stats.total - stats.pending} of {stats.total} approved
                </p>
              </div>
              {stats.pending > 0 ? (
                <ApproveAssessmentButton assessmentId={a.id} />
              ) : (
                <span className="rounded-full bg-leaf-soft px-3 py-1 text-xs font-medium text-leaf">
                  All approved
                </span>
              )}
            </div>
          );
        })}

        {!withGrades.length && (
          <p className="text-sm text-ink-soft">No grades entered yet.</p>
        )}
      </div>
    </div>
  );
}