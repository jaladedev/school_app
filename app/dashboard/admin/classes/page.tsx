import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CreateClassForm } from "@/components/CreateClassForm";
import { ClassRow } from "@/components/ClassRow";
import { EmptyState } from "@/components/EmptyState";

export default async function AdminClassesPage() {
  const supabase = createClient();

  const { data: classes } = await supabase
    .from("classes")
    .select("*")
    .eq("is_archived", false)
    .order("education_level", { ascending: true })
    .order("level_number", { ascending: true })
    .order("arm", { ascending: true });

  const { count: archivedCount } = await supabase
    .from("classes")
    .select("id", { count: "exact", head: true })
    .eq("is_archived", true);

  const { data: studentCounts } = await supabase.from("student_profiles").select("class_id");

  const countByClass = new Map<string, number>();
  for (const row of studentCounts ?? []) {
    if (!row.class_id) continue;
    countByClass.set(row.class_id, (countByClass.get(row.class_id) ?? 0) + 1);
  }

  const { data: teacherProfiles } = await supabase
    .from("teacher_profiles")
    .select("id, profiles(full_name)");

  const teachers = (teacherProfiles ?? []).map((t) => ({
    id: t.id,
    full_name: t.profiles?.full_name ?? "Unknown",
  }));

  const { data: entries } = await supabase.from("timetable_entries").select("class_id, subject_id");

  const timetableStatsByClass = new Map<string, { periodCount: number; subjectIds: Set<string> }>();
  for (const e of entries ?? []) {
    const stats = timetableStatsByClass.get(e.class_id) ?? {
      periodCount: 0,
      subjectIds: new Set<string>(),
    };
    stats.periodCount += 1;
    stats.subjectIds.add(e.subject_id);
    timetableStatsByClass.set(e.class_id, stats);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Classes</h1>
          <p className="text-sm text-ink-soft">
            {classes?.length ?? 0} active classes.{" "}
            {!!archivedCount && (
              <Link href="/dashboard/admin/classes/archived" className="text-leaf hover:underline">
                {archivedCount} archived →
              </Link>
            )}
          </p>
        </div>
        <CreateClassForm />
      </div>

      <div className="space-y-2">
        {classes?.map((cls) => {
          const stats = timetableStatsByClass.get(cls.id);
          return (
            <ClassRow
              key={cls.id}
              classId={cls.id}
              name={cls.name}
              arm={cls.arm}
              educationLevel={cls.education_level}
              levelNumber={cls.level_number}
              academicYear={cls.academic_year}
              isArchived={cls.is_archived}
              studentCount={countByClass.get(cls.id) ?? 0}
              subjectsScheduledCount={stats?.subjectIds.size ?? 0}
              periodsPerWeek={stats?.periodCount ?? 0}
              currentTeacherId={cls.class_teacher_id}
              teachers={teachers}
            />
          );
        })}

        {!classes?.length && <EmptyState message="No active classes." />}
      </div>
    </div>
  );
}
