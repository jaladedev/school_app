import { createClient } from "@/lib/supabase/server";
import { Pagination, DEFAULT_PAGE_SIZE, parsePage, pageRange } from "@/components/Pagination";
import { EmptyState } from "@/components/EmptyState";

const ENTITY_TYPES = [
  "profile",
  "teacher_profile",
  "assessment",
  "quiz",
  "grade",
  "enrollment",
  "fee_structure",
  "invoice",
  "payment",
] as const;

function actionLabel(action: string): string {
  return action.replaceAll("_", " ");
}

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ entityType?: string; page?: string }>;
}) {
  const resolvedSearchParams = await searchParams;

  const supabase = createClient();
  const entityTypeFilter = ENTITY_TYPES.includes(
    resolvedSearchParams.entityType as (typeof ENTITY_TYPES)[number]
  )
    ? resolvedSearchParams.entityType
    : undefined;
  const page = parsePage(resolvedSearchParams.page);
  const { from, to } = pageRange(page, DEFAULT_PAGE_SIZE);

  let query = supabase
    .from("audit_log")
    .select("*, profiles(full_name)", { count: "exact" })
    .order("created_at", { ascending: false });

  if (entityTypeFilter) {
    query = query.eq("entity_type", entityTypeFilter);
  }

  const { data: entries, count } = await query.range(from, to);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / DEFAULT_PAGE_SIZE));

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">Audit Log</h1>
      <p className="mb-6 text-sm text-ink-soft">
        A record of sensitive actions taken across the app — who did what, and when.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        <a
          href="/dashboard/admin/audit-log"
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            !entityTypeFilter ? "bg-leaf-soft text-leaf" : "border border-rule text-ink-soft"
          }`}
        >
          All
        </a>
        {ENTITY_TYPES.map((type) => (
          <a
            key={type}
            href={`/dashboard/admin/audit-log?entityType=${type}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              entityTypeFilter === type
                ? "bg-leaf-soft text-leaf"
                : "border border-rule text-ink-soft"
            }`}
          >
            {type.replaceAll("_", " ")}
          </a>
        ))}
      </div>

      <div className="space-y-2">
        {(entries ?? []).map((entry) => (
          <div key={entry.id} className="rounded-lg border border-rule bg-white px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium capitalize text-ink">{actionLabel(entry.action)}</p>
              <p className="shrink-0 text-xs text-ink-soft">
                {new Date(entry.created_at).toLocaleString()}
              </p>
            </div>
            <p className="mt-1 text-xs text-ink-soft">
              {entry.entity_type} · {entry.entity_id}
              {entry.profiles?.full_name ? ` · by ${entry.profiles.full_name}` : " · by system"}
            </p>
            {entry.metadata && Object.keys(entry.metadata).length > 0 && (
              <pre className="mt-2 overflow-x-auto rounded-md bg-paper p-2 text-xs text-ink-soft">
                {JSON.stringify(entry.metadata, null, 2)}
              </pre>
            )}
          </div>
        ))}

        {!entries?.length && <EmptyState message="No audit log entries yet." />}
      </div>

      <Pagination
        basePath="/dashboard/admin/audit-log"
        page={page}
        totalPages={totalPages}
        searchParams={entityTypeFilter ? { entityType: entityTypeFilter } : {}}
      />
    </div>
  );
}
