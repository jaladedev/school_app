import { createClient } from "@/lib/supabase/server";
import { CreateSubjectForm } from "@/components/CreateSubjectForm";
import { formatLevel, type EducationLevel } from "@/types/database";
import { Pagination, DEFAULT_PAGE_SIZE, parsePage, pageRange } from "@/components/Pagination";
import { EmptyState } from "@/components/EmptyState";

const STAGE_ORDER: EducationLevel[] = ["primary", "jss", "sss"];
const STAGE_LABELS: Record<EducationLevel, string> = {
  primary: "Primary",
  jss: "Junior Secondary (JSS)",
  sss: "Senior Secondary (SS)",
};

export default async function AdminSubjectsPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const supabase = createClient();
  const page = parsePage(searchParams.page);
  const { from, to } = pageRange(page, DEFAULT_PAGE_SIZE);

  const { data: subjects, count } = await supabase
    .from("subjects")
    .select("*", { count: "exact" })
    .order("education_level", { ascending: true })
    .order("min_level_number", { ascending: true })
    .order("name", { ascending: true })
    .range(from, to);

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / DEFAULT_PAGE_SIZE));

  const byStage = new Map<EducationLevel, typeof subjects>();
  for (const s of subjects ?? []) {
    byStage.set(s.education_level, [...(byStage.get(s.education_level) ?? []), s]);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Subjects</h1>
          <p className="text-sm text-ink-soft">
            {count ?? 0} subjects across Primary, JSS and SS · page {page} of {totalPages}
          </p>
        </div>
        <CreateSubjectForm />
      </div>

      {STAGE_ORDER.map((stage) => {
        const stageSubjects = byStage.get(stage) ?? [];
        if (!stageSubjects.length) return null;

        return (
          <div key={stage} className="mb-8">
            <h2 className="mb-3 font-display text-lg font-semibold text-ink">
              {STAGE_LABELS[stage]}
            </h2>
            <div className="space-y-2">
              {stageSubjects.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border border-rule bg-white px-4 py-3"
                >
                  <div>
                    <p className="text-ink">{s.name}</p>
                    {s.description && <p className="text-xs text-ink-soft">{s.description}</p>}
                  </div>
                  <span className="text-sm text-ink-soft">
                    {formatLevel(s.education_level, s.min_level_number)} –{" "}
                    {formatLevel(s.education_level, s.max_level_number)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {!subjects?.length && <EmptyState message="No subjects created yet." />}

      <Pagination basePath="/dashboard/admin/subjects" page={page} totalPages={totalPages} />
    </div>
  );
}
