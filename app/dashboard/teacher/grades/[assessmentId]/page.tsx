import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { GradeEntryForm } from "@/components/GradeEntryForm";
import { GradeCsvImport } from "@/components/GradeCsvImport";
import { EmptyState } from "@/components/EmptyState";

export default async function GradeEntryPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const resolvedParams = await params;

  const supabase = createClient();

  const { data: assessment } = await supabase
    .from("assessments")
    .select("*, classes(id, name, arm)")
    .eq("id", resolvedParams.assessmentId)
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
    .eq("assessment_id", resolvedParams.assessmentId);

  const initialGrades: Record<string, { score: number; remark: string | null }> = {};
  for (const g of existingGrades ?? []) {
    initialGrades[g.student_id] = { score: g.score, remark: g.remark };
  }

  return (
    <div className="max-w-xl">
      <Link
        href="/dashboard/teacher/grades"
        className="mb-2 inline-block text-sm text-leaf hover:underline"
      >
        ← Grades
      </Link>
      <p className="mb-1 text-xs uppercase tracking-wide text-leaf">
        {assessment?.classes?.name} {assessment?.classes?.arm}
      </p>
      <h1 className="mb-6 font-display text-2xl font-semibold text-ink">
        {assessment?.title}{" "}
        <span className="text-base font-normal text-ink-soft">/ {assessment?.max_score}</span>
      </h1>

      {students.length ? (
        <>
          <GradeCsvImport assessmentId={resolvedParams.assessmentId} />
          <GradeEntryForm
            assessmentId={resolvedParams.assessmentId}
            maxScore={assessment?.max_score ?? 100}
            students={students}
            initialGrades={initialGrades}
          />
        </>
      ) : (
        <EmptyState message="No students found in this class." />
      )}
    </div>
  );
}
