import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CreateClassForm } from "@/components/CreateClassForm";

export default async function AdminClassesPage() {
  const supabase = createClient();

  const { data: classes } = await supabase
    .from("classes")
    .select("*")
    .order("grade_level", { ascending: true })
    .order("arm", { ascending: true });

  const { data: studentCounts } = await supabase
    .from("student_profiles")
    .select("class_id");

  const countByClass = new Map<string, number>();
  for (const row of studentCounts ?? []) {
    if (!row.class_id) continue;
    countByClass.set(row.class_id, (countByClass.get(row.class_id) ?? 0) + 1);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Classes</h1>
          <p className="text-sm text-ink-soft">
            {classes?.length ?? 0} classes across all grade levels.
          </p>
        </div>
        <CreateClassForm />
      </div>

      <div className="space-y-2">
        {classes?.map((cls) => (
          <div
            key={cls.id}
            className="flex items-center justify-between rounded-lg border border-rule bg-white px-4 py-3"
          >
            <div>
              <p className="font-medium text-ink">
                {cls.name} {cls.arm}
              </p>
              <p className="text-sm text-ink-soft">
                Grade {cls.grade_level} · {cls.academic_year} ·{" "}
                {countByClass.get(cls.id) ?? 0} students
              </p>
            </div>
            <Link
              href={`/dashboard/admin/timetables/${cls.id}`}
              className="text-sm font-medium text-leaf hover:underline"
            >
              View timetable →
            </Link>
          </div>
        ))}

        {!classes?.length && (
          <p className="text-sm text-ink-soft">No classes created yet.</p>
        )}
      </div>
    </div>
  );
}
