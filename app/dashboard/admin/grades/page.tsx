import { createClient } from "@/lib/supabase/server";
import { ApproveAssessmentButton } from "@/components/ApproveAssessmentButton";
import { ExportGradeSheetButton } from "@/components/ExportGradeSheetButton";
import { Pagination, DEFAULT_PAGE_SIZE, parsePage } from "@/components/Pagination";
import { EmptyState } from "@/components/EmptyState";

export default async function AdminGradesModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const resolvedSearchParams = await searchParams;

  const supabase = createClient();
  const page = parsePage(resolvedSearchParams.page);

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
  const totalPages = Math.max(1, Math.ceil(withGrades.length / DEFAULT_PAGE_SIZE));
  const pageStart = (page - 1) * DEFAULT_PAGE_SIZE;
  const pageItems = withGrades.slice(pageStart, pageStart + DEFAULT_PAGE_SIZE);

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">Grade Moderation</h1>
      <p className="mb-6 text-sm text-ink-soft">
        Grades stay hidden from students until approved here.
      </p>

      <div className="space-y-2">
        {pageItems.map((a) => {
          const stats = statsByAssessment.get(a.id)!;
          return (
            <div
              key={a.id}
              className="flex items-center justify-between rounded-lg border border-rule bg-white px-4 py-3"
            >
              <div>
                <p className="font-medium text-ink">{a.title}</p>
                <p className="text-xs text-ink-soft">
                  {a.subjects?.name} · {a.classes?.name} {a.classes?.arm} · Term {a.term} ·{" "}
                  {a.academic_year}
                </p>
                <p className="mt-1 text-xs text-ink-soft">
                  {stats.total - stats.pending} of {stats.total} approved
                </p>
              </div>
              <div className="flex items-center gap-3">
                <ExportGradeSheetButton
                  assessmentId={a.id}
                  assessmentTitle={`${a.title}-${a.classes?.name ?? ""}`}
                  classId={a.class_id}
                  maxScore={a.max_score}
                />
                {stats.pending > 0 ? (
                  <ApproveAssessmentButton assessmentId={a.id} />
                ) : (
                  <span className="rounded-full bg-leaf-soft px-3 py-1 text-xs font-medium text-leaf">
                    All approved
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {!withGrades.length && <EmptyState message="No grades entered yet." />}
      </div>

      <Pagination basePath="/dashboard/admin/grades" page={page} totalPages={totalPages} />
    </div>
  );
}
