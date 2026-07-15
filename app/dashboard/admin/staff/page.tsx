import { createClient } from "@/lib/supabase/server";
import { CreateTeacherForm } from "@/components/CreateTeacherForm";
import { TeacherRow } from "@/components/TeacherRow";
import { SearchInput } from "@/components/SearchInput";

export default async function AdminStaffPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const supabase = createClient();
  const q = searchParams.q?.trim();

  let matchingIds: string[] | null = null;

  if (q) {
    const { data: matchingProfiles } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "teacher")
      .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);

    matchingIds = (matchingProfiles ?? []).map((p) => p.id);
  }

  let teacherQuery = supabase
    .from("teacher_profiles")
    .select("*, profiles(full_name, email, is_active)")
    .order("id");

  if (matchingIds !== null) {
    teacherQuery = teacherQuery.in(
      "id",
      matchingIds.length ? matchingIds : ["00000000-0000-0000-0000-000000000000"]
    );
  }

  const { data: teachers } = await teacherQuery;

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
            {teachers?.length ?? 0} teachers{q ? ` matching "${q}"` : " on record"}.
          </p>
        </div>
        <CreateTeacherForm subjects={subjects ?? []} />
      </div>

      <div className="mb-4">
        <SearchInput placeholder="Search by name or email" />
      </div>

      <div className="space-y-2">
        {teachers?.map((teacher) => {
          const profile = teacher.profiles;
          const subjectIds = teacher.subjects_taught ?? [];
          return (
            <TeacherRow
              key={teacher.id}
              teacherId={teacher.id}
              fullName={profile?.full_name ?? "Unknown"}
              email={profile?.email ?? ""}
              isActive={profile?.is_active ?? true}
              subjectNames={subjectIds.map((id: string) => subjectNameById.get(id) ?? "Unknown")}
              currentSubjectIds={subjectIds}
              allSubjects={subjects ?? []}
            />
          );
        })}

        {!teachers?.length && (
          <p className="text-sm text-ink-soft">
            {q ? `No teachers match "${q}".` : "No teachers yet."}
          </p>
        )}
      </div>
    </div>
  );
}