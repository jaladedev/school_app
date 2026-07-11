import { createClient } from "@/lib/supabase/server";
import { CreateTeacherForm } from "@/components/CreateTeacherForm";
import { TeacherRow } from "@/components/TeacherRow";

export default async function AdminStaffPage() {
  const supabase = createClient();

  const { data: teachers } = await supabase
    .from("teacher_profiles")
    .select("*, profiles(full_name, email)")
    .order("id");

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
            {teachers?.length ?? 0} teachers on record.
          </p>
        </div>
        <CreateTeacherForm subjects={subjects ?? []} />
      </div>

      <div className="space-y-2">
        {teachers?.map((teacher) => {
          const profile = (teacher as any).profiles;
          const subjectIds = teacher.subjects_taught ?? [];
          return (
            <TeacherRow
              key={teacher.id}
              teacherId={teacher.id}
              fullName={profile?.full_name ?? "Unknown"}
              email={profile?.email ?? ""}
              subjectNames={subjectIds.map((id: string) => subjectNameById.get(id) ?? "Unknown")}
              currentSubjectIds={subjectIds}
              allSubjects={subjects ?? []}
            />
          );
        })}

        {!teachers?.length && (
          <p className="text-sm text-ink-soft">No teachers yet.</p>
        )}
      </div>
    </div>
  );
}
