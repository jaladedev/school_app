import { createClient } from "@/lib/supabase/server";
import { CreateStudentForm } from "@/components/CreateStudentForm";
import { BulkCreateStudentsForm } from "@/components/BulkCreateStudentsForm";

export default async function AdminStudentsPage() {
  const supabase = createClient();

  const { data: students } = await supabase
    .from("student_profiles")
    .select("*, profiles(full_name, email), classes(name, arm)")
    .order("admission_no", { ascending: true });

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, arm")
    .order("education_level", { ascending: true })
    .order("level_number", { ascending: true });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Students</h1>
          <p className="text-sm text-ink-soft">
            {students?.length ?? 0} students enrolled.
          </p>
        </div>
        <div className="flex gap-2">
          <CreateStudentForm classes={classes ?? []} />
          <BulkCreateStudentsForm classes={classes ?? []} />
        </div>
      </div>

      <div className="space-y-2">
        {students?.map((s) => {
          const profile = (s as any).profiles;
          const cls = (s as any).classes;
          return (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-lg border border-rule bg-white px-4 py-3"
            >
              <div>
                <p className="font-medium text-ink">{profile?.full_name}</p>
                <p className="text-sm text-ink-soft">{profile?.email}</p>
                {s.admission_no && (
                  <p className="text-xs text-ink-soft">Admission no. {s.admission_no}</p>
                )}
              </div>
              <span className="rounded-full bg-leaf-soft px-3 py-1 text-sm font-medium text-leaf">
                {cls ? `${cls.name} ${cls.arm ?? ""}` : "Unassigned"}
              </span>
            </div>
          );
        })}

        {!students?.length && (
          <p className="text-sm text-ink-soft">No students yet.</p>
        )}
      </div>
    </div>
  );
}