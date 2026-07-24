import { createClient } from "@/lib/supabase/server";
import { CreateTeacherForm } from "@/components/CreateTeacherForm";
import { TeacherRow } from "@/components/TeacherRow";
import { SearchInput } from "@/components/SearchInput";
import { Pagination, DEFAULT_PAGE_SIZE, parsePage, pageRange } from "@/components/Pagination";

function escapeIlike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function sanitizeSearchQuery(raw: string): string {
  return raw.trim().slice(0, 100);
}

export default async function AdminStaffPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const resolvedSearchParams = await searchParams;

  const supabase = createClient();
  const qRaw = resolvedSearchParams.q?.trim() ?? "";
  const q = sanitizeSearchQuery(qRaw);
  const page = parsePage(resolvedSearchParams.page);
  const { from, to } = pageRange(page, DEFAULT_PAGE_SIZE);

  let matchingIds: string[] | null = null;

  if (q) {
    const safe = escapeIlike(q);
    const pattern = `%${safe}%`;

    const [byFullName, byEmail] = await Promise.all([
      supabase.from("profiles").select("id").eq("role", "teacher").ilike("full_name", pattern),
      supabase.from("profiles").select("id").eq("role", "teacher").ilike("email", pattern),
    ]);

    matchingIds = [
      ...new Set([
        ...(byFullName.data ?? []).map((p) => p.id),
        ...(byEmail.data ?? []).map((p) => p.id),
      ]),
    ];
  }

  let teacherQuery = supabase
    .from("teacher_profiles")
    .select("*, profiles(full_name, email, is_active)", { count: "exact" })
    .order("id");

  if (matchingIds !== null) {
    teacherQuery = teacherQuery.in(
      "id",
      matchingIds.length ? matchingIds : ["00000000-0000-0000-0000-000000000000"]
    );
  }

  const { data: teachers, count } = await teacherQuery.range(from, to);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / DEFAULT_PAGE_SIZE));

  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, name, education_level, min_level_number, max_level_number")
    .order("name");

  const subjectNameById = new Map((subjects ?? []).map((s) => [s.id, s.name]));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Staff</h1>
          <p className="text-sm text-ink-soft">
            {count ?? 0} teachers{q ? ` matching "${qRaw}"` : " on record"} · page {page} of{" "}
            {totalPages}
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
              staffRole={teacher.staff_role ?? "teacher"}
            />
          );
        })}

        {!teachers?.length && (
          <p className="text-sm text-ink-soft">
            {q ? `No teachers match "${qRaw}".` : "No teachers yet."}
          </p>
        )}
      </div>

      <Pagination
        basePath="/dashboard/admin/staff"
        page={page}
        totalPages={totalPages}
        searchParams={{ q: qRaw }}
      />
    </div>
  );
}
