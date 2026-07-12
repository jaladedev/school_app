import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CreateStudentForm } from "@/components/CreateStudentForm";
import { BulkCreateStudentsForm } from "@/components/BulkCreateStudentsForm";
import { ResetPasswordButton } from "@/components/ResetPasswordButton";
import { DeactivateUserButton } from "@/components/DeactivateUserButton";
import { SearchInput } from "@/components/SearchInput";

const PAGE_SIZE = 25;

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: { page?: string; q?: string };
}) {
  const supabase = createClient();
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const q = searchParams.q?.trim();

  let matchingIds: string[] | null = null;

  if (q) {
    const { data: matchingProfiles } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "student")
      .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);

    const { data: matchingByAdmission } = await supabase
      .from("student_profiles")
      .select("id")
      .ilike("admission_no", `%${q}%`);

    matchingIds = [
      ...new Set([
        ...(matchingProfiles ?? []).map((p) => p.id),
        ...(matchingByAdmission ?? []).map((s) => s.id),
      ]),
    ];
  }

  let query = supabase
    .from("student_profiles")
    .select("*, profiles(full_name, email, is_active), classes(name, arm)", { count: "exact" })
    .order("admission_no", { ascending: true });

  if (matchingIds !== null) {
    query = query.in("id", matchingIds.length ? matchingIds : ["00000000-0000-0000-0000-000000000000"]);
  }

  const { data: students, count } = await query.range(from, to);

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, arm")
    .eq("is_archived", false)
    .order("education_level", { ascending: true })
    .order("level_number", { ascending: true });

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Students</h1>
          <p className="text-sm text-ink-soft">
            {count ?? 0} students{q ? ` matching "${q}"` : " enrolled"} · page {page} of{" "}
            {totalPages}
          </p>
        </div>
        <div className="flex gap-2">
          <CreateStudentForm classes={classes ?? []} />
          <BulkCreateStudentsForm classes={classes ?? []} />
        </div>
      </div>

      <div className="mb-4">
        <SearchInput placeholder="Search by name, email, or admission no." />
      </div>

      <div className="space-y-2">
        {students?.map((s) => {
          const profile = (s as any).profiles;
          const cls = (s as any).classes;
          const isActive = profile?.is_active ?? true;
          return (
            <div
              key={s.id}
              className={`flex items-center justify-between rounded-lg border border-rule bg-white px-4 py-3 ${
                !isActive ? "opacity-60" : ""
              }`}
            >
              <Link href={`/dashboard/admin/students/${s.id}`} className="flex-1 hover:opacity-80">
                <p className="font-medium text-ink">
                  {profile?.full_name}
                  {!isActive && <span className="ml-2 text-xs font-normal text-clay">(deactivated)</span>}
                </p>
                <p className="text-sm text-ink-soft">{profile?.email}</p>
                {s.admission_no && (
                  <p className="text-xs text-ink-soft">Admission no. {s.admission_no}</p>
                )}
              </Link>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-leaf-soft px-3 py-1 text-sm font-medium text-leaf">
                  {cls ? `${cls.name} ${cls.arm ?? ""}` : "Unassigned"}
                </span>
                <ResetPasswordButton userId={s.id} />
                <DeactivateUserButton userId={s.id} isActive={isActive} />
                <Link
                  href={`/dashboard/admin/students/${s.id}`}
                  className="text-sm font-medium text-leaf hover:underline"
                >
                  View →
                </Link>
              </div>
            </div>
          );
        })}

        {!students?.length && (
          <p className="text-sm text-ink-soft">
            {q ? `No students match "${q}".` : "No students yet."}
          </p>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href={`/dashboard/admin/students?page=${Math.max(1, page - 1)}${q ? `&q=${q}` : ""}`}
            aria-disabled={page <= 1}
            className={`rounded-lg border border-rule px-3 py-1.5 text-sm ${
              page <= 1 ? "pointer-events-none opacity-40" : "text-ink hover:bg-white"
            }`}
          >
            Previous
          </Link>
          <span className="text-sm text-ink-soft">
            Page {page} of {totalPages}
          </span>
          <Link
            href={`/dashboard/admin/students?page=${Math.min(totalPages, page + 1)}${q ? `&q=${q}` : ""}`}
            aria-disabled={page >= totalPages}
            className={`rounded-lg border border-rule px-3 py-1.5 text-sm ${
              page >= totalPages ? "pointer-events-none opacity-40" : "text-ink hover:bg-white"
            }`}
          >
            Next
          </Link>
        </div>
      )}
    </div>
  );
}