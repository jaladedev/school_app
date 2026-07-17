import { createClient } from "@/lib/supabase/server";
import { GradeEntryForm } from "@/components/GradeEntryForm";
import { EmptyState } from "@/components/EmptyState";

export default async function GradeEntryPage({
  params,
}: {
  params: { assessmentId: string };
}) {
  const supabase = createClient();

  const { data: assessment } = await supabase
    .from("assessments")
    .select("*, classes(id, name, arm)")
    .eq("id", params.assessmentId)
    .single();

  const classId = assessment?.classes?.id;

  const { data: roster } = await supabase
    .from("student_profiles")
    .select("id, profiles(full_name)")
    .eq("class_id", classId ?? "");

  const students = (roster ?? [])
    .map((r: any) => ({ id: r.id, full_name: r.profiles?.full_name ?? "Unknown" }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  const { data: existingGrades } = await supabase
    .from("grades")
    .select("student_id, score, remark")
    .eq("assessment_id", params.assessmentId);

  const initialGrades: Record<string, { score: number; remark: string | null }> = {};
  for (const g of existingGrades ?? []) {
    initialGrades[g.student_id] = { score: g.score, remark: g.remark };
  }

  return (
    <div className="max-w-xl">
      <p className="mb-1 text-xs uppercase tracking-wide text-leaf">
        {assessment?.classes?.name} {assessment?.classes?.arm}
      </p>
      <h1 className="mb-6 font-display text-2xl font-semibold text-ink">
        {assessment?.title}{" "}
        <span className="text-base font-normal text-ink-soft">
          / {assessment?.max_score}
        </span>
      </h1>

      {students.length ? (
        <GradeEntryForm
          assessmentId={params.assessmentId}
          maxScore={assessment?.max_score ?? 100}
          students={students}
          initialGrades={initialGrades}
        />
      ) : (
        <EmptyState message="No students found in this class." />
      )}
    </div>
  );
}