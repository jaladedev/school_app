import { createClient } from "@/lib/supabase/server";
import { formatLevel } from "@/types/database";
import { UnarchiveButton } from "@/components/UnarchiveButton";
import { Pagination, DEFAULT_PAGE_SIZE, parsePage, pageRange } from "@/components/Pagination";
import { EmptyState } from "@/components/EmptyState";

export default async function ArchivedClassesPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const supabase = createClient();
  const page = parsePage(searchParams.page);
  const { from, to } = pageRange(page, DEFAULT_PAGE_SIZE);

  const { data: classes, count } = await supabase
    .from("classes")
    .select("*", { count: "exact" })
    .eq("is_archived", true)
    .order("education_level", { ascending: true })
    .order("level_number", { ascending: true })
    .range(from, to);

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / DEFAULT_PAGE_SIZE));

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">Archived classes</h1>
      <p className="mb-6 text-sm text-ink-soft">
        Historical data (grades, attendance, enrollments) is preserved — archiving just hides a
        class from the active list.
      </p>

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
                {formatLevel(cls.education_level, cls.level_number)} · {cls.academic_year}
              </p>
            </div>
            <UnarchiveButton classId={cls.id} />
          </div>
        ))}

        {!classes?.length && <EmptyState message="No archived classes." />}
      </div>

      <Pagination
        basePath="/dashboard/admin/classes/archived"
        page={page}
        totalPages={totalPages}
      />
    </div>
  );
}
