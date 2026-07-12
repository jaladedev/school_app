import { createClient } from "@/lib/supabase/server";
import { CreateSubjectForm } from "@/components/CreateSubjectForm";
import { formatLevel, type EducationLevel } from "@/types/database";

const STAGE_ORDER: EducationLevel[] = ["primary", "jss", "sss"];
const STAGE_LABELS: Record<EducationLevel, string> = {
  primary: "Primary",
  jss: "Junior Secondary (JSS)",
  sss: "Senior Secondary (SS)",
};

export default async function AdminSubjectsPage() {
  const supabase = createClient();

  const { data: subjects } = await supabase
    .from("subjects")
    .select("*")
    .order("education_level", { ascending: true })
    .order("min_level_number", { ascending: true })
    .order("name", { ascending: true });

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
            {subjects?.length ?? 0} subjects across Primary, JSS and SS.
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
                    {s.description && (
                      <p className="text-xs text-ink-soft">{s.description}</p>
                    )}
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

      {!subjects?.length && (
        <p className="text-sm text-ink-soft">No subjects created yet.</p>
      )}
    </div>
  );
}