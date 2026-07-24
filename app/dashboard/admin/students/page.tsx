import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CreateStudentForm } from "@/components/CreateStudentForm";
import { BulkCreateStudentsForm } from "@/components/BulkCreateStudentsForm";
import { ExportStudentsButton } from "@/components/ExportStudentsButton";
import { ResetPasswordButton } from "@/components/ResetPasswordButton";
import { DeactivateUserButton } from "@/components/DeactivateUserButton";
import { SearchInput } from "@/components/SearchInput";
import { Pagination, DEFAULT_PAGE_SIZE, parsePage, pageRange } from "@/components/Pagination";

const PAGE_SIZE = DEFAULT_PAGE_SIZE;

// Escape Postgres ILIKE wildcards so a search term is matched literally,
// and avoid building a raw PostgREST filter-grammar string (.or()) from
// user input — an unescaped comma/paren in q could otherwise smuggle in
// extra filter clauses via PostgREST's .or() syntax.
function escapeIlike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function sanitizeSearchQuery(raw: string): string {
  return raw.trim().slice(0, 100);
}

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const resolvedSearchParams = await searchParams;

  const supabase = createClient();
  const page = parsePage(resolvedSearchParams.page);
  const { from, to } = pageRange(page, PAGE_SIZE);
  const qRaw = resolvedSearchParams.q?.trim() ?? "";
  const q = sanitizeSearchQuery(qRaw);

  let matchingIds: string[] | null = null;

  if (q) {
    const safe = escapeIlike(q);
    const pattern = `%${safe}%`;

    const [byFullName, byEmail, byAdmission] = await Promise.all([
      supabase.from("profiles").select("id").eq("role", "student").ilike("full_name", pattern),
      supabase.from("profiles").select("id").eq("role", "student").ilike("email", pattern),
      supabase.from("student_profiles").select("id").ilike("admission_no", pattern),
    ]);

    matchingIds = [
      ...new Set([
        ...(byFullName.data ?? []).map((p) => p.id),
        ...(byEmail.data ?? []).map((p) => p.id),
        ...(byAdmission.data ?? []).map((s) => s.id),
      ]),
    ];
  }

  let query = supabase
    .from("student_profiles")
    .select("*, profiles(full_name, email, is_active), classes(name, arm)", { count: "exact" })
    .order("admission_no", { ascending: true });

  if (matchingIds !== null) {
    query = query.in(
      "id",
      matchingIds.length ? matchingIds : ["00000000-0000-0000-0000-000000000000"]
    );
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
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Students</h1>
          <p className="text-sm text-ink-soft">
            {count ?? 0} students{q ? ` matching "${qRaw}"` : " enrolled"} · page {page} of{" "}
            {totalPages}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportStudentsButton />
          <CreateStudentForm classes={classes ?? []} />
          <BulkCreateStudentsForm classes={classes ?? []} />
        </div>
      </div>

      <div className="mb-4">
        <SearchInput placeholder="Search by name, email, or admission no." />
      </div>

      <div className="space-y-2">
        {students?.map((s) => {
          const profile = s.profiles;
          const cls = s.classes;
          const isActive = profile?.is_active ?? true;
          return (
            <div
              key={s.id}
              className={`flex flex-col gap-3 rounded-lg border border-rule bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
                !isActive ? "opacity-60" : ""
              }`}
            >
              <Link href={`/dashboard/admin/students/${s.id}`} className="flex-1 hover:opacity-80">
                <p className="font-medium text-ink">
                  {profile?.full_name}
                  {!isActive && (
                    <span className="ml-2 text-xs font-normal text-clay">(deactivated)</span>
                  )}
                </p>
                <p className="text-sm text-ink-soft">{profile?.email}</p>
                {s.admission_no && (
                  <p className="text-xs text-ink-soft">Admission no. {s.admission_no}</p>
                )}
              </Link>
              <div className="flex flex-wrap items-center gap-3">
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
            {q ? `No students match "${qRaw}".` : "No students yet."}
          </p>
        )}
      </div>

      <Pagination
        basePath="/dashboard/admin/students"
        page={page}
        totalPages={totalPages}
        searchParams={{ q: qRaw }}
      />
    </div>
  );
}
