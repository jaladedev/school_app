import { createClient } from "@/lib/supabase/server";
import { AssignTeacherForm } from "@/components/AssignTeacherForm";

export default async function AdminStaffPage() {
  const supabase = createClient();

  const { data: teacherProfiles } = await supabase
    .from("teacher_profiles")
    .select("*, profiles(full_name, email)");

  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, name")
    .order("name");

  const subjectNameById = new Map((subjects ?? []).map((s) => [s.id, s.name]));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Staff</h1>
          <p className="text-sm text-ink-soft">
            {teacherProfiles?.length ?? 0} teachers on record.
          </p>
        </div>
        <AssignTeacherForm subjects={subjects ?? []} />
      </div>

      <div className="space-y-2">
        {teacherProfiles?.map((t) => {
          const profile = (t as any).profiles;
          const subjectNames = (t.subjects_taught ?? [])
            .map((id: string) => subjectNameById.get(id))
            .filter(Boolean);

          return (
            <div
              key={t.id}
              className="rounded-lg border border-rule bg-white px-4 py-3"
            >
              <p className="font-medium text-ink">{profile?.full_name}</p>
              <p className="text-sm text-ink-soft">{profile?.email}</p>
              <p className="mt-1 text-sm text-ink-soft">
                {subjectNames.length
                  ? subjectNames.join(", ")
                  : "No subjects assigned yet"}
              </p>
            </div>
          );
        })}

        {!teacherProfiles?.length && (
          <p className="text-sm text-ink-soft">No teachers assigned yet.</p>
        )}
      </div>
    </div>
  );
}
