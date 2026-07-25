import { createClient } from "@/lib/supabase/server";
import { CreateAssetForm } from "@/components/CreateAssetForm";
import { AssetRow } from "@/components/AssetRow";
import { EmptyState } from "@/components/EmptyState";
import { Pagination, DEFAULT_PAGE_SIZE, parsePage, pageRange } from "@/components/Pagination";
import type { Asset } from "@/types/database";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; archived?: string; page?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const supabase = createClient();

  const q = resolvedSearchParams.q?.trim() ?? "";
  const showArchived = resolvedSearchParams.archived === "1";
  const page = parsePage(resolvedSearchParams.page);
  const { from, to } = pageRange(page, DEFAULT_PAGE_SIZE);

  let query = supabase
    .from("assets")
    .select("*", { count: "exact" })
    .eq("is_archived", showArchived)
    .order("created_at", { ascending: false });

  if (q) {
    query = query.or(`name.ilike.%${q}%,serial_no.ilike.%${q}%,category.ilike.%${q}%`);
  }

  const { data: assets, count } = await query.range(from, to);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / DEFAULT_PAGE_SIZE));

  return (
    <div className="max-w-4xl">
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">Inventory</h1>
      <p className="mb-6 text-sm text-ink-soft">
        Track school assets — furniture, lab equipment, computers, sports gear — and where each one
        currently is.
      </p>

      <CreateAssetForm />

      <form className="mb-4 mt-6 flex flex-wrap gap-2" action={`/dashboard/admin/inventory`}>
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search name, serial no., or category…"
          className="min-w-0 flex-1 rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
        />
        {showArchived && <input type="hidden" name="archived" value="1" />}
        <button
          type="submit"
          className="rounded-lg border border-rule px-3 py-2 text-sm font-medium text-ink hover:bg-white"
        >
          Search
        </button>
        <a
          href={`/dashboard/admin/inventory${showArchived ? "" : "?archived=1"}${q ? `${showArchived ? "?" : "&"}q=${encodeURIComponent(q)}` : ""}`}
          className={`rounded-lg border px-3 py-2 text-sm font-medium ${
            showArchived
              ? "border-leaf bg-leaf-soft text-leaf"
              : "border-rule text-ink-soft hover:bg-white"
          }`}
        >
          {showArchived ? "Showing archived" : "Show archived"}
        </a>
      </form>

      <div className="space-y-2">
        {(assets as Asset[] | null)?.map((asset) => (
          <AssetRow key={asset.id} asset={asset} />
        ))}
        {!assets?.length && (
          <EmptyState
            message={
              showArchived ? "No archived assets." : "No assets yet — add the first one above."
            }
          />
        )}
      </div>

      <Pagination
        basePath="/dashboard/admin/inventory"
        page={page}
        totalPages={totalPages}
        searchParams={{ q, archived: showArchived ? "1" : undefined }}
      />
    </div>
  );
}
