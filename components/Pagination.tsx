import Link from "next/link";

export const DEFAULT_PAGE_SIZE = 25;

export function parsePage(raw: string | undefined): number {
  const n = Number(raw ?? 1);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export function pageRange(page: number, pageSize: number): { from: number; to: number } {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

/**
 * Renders Previous/Next controls for a paginated list.
 *
 * `basePath` is the route (e.g. "/dashboard/admin/staff") and
 * `searchParams` should be the full current searchParams object from the
 * page — every existing param (search query, filters, etc.) is preserved
 * and correctly URL-encoded via URLSearchParams, and only `page` is
 * overwritten per link.
 */
export function Pagination({
  basePath,
  page,
  totalPages,
  searchParams = {},
}: {
  basePath: string;
  page: number;
  totalPages: number;
  searchParams?: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;

  function hrefFor(targetPage: number): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (key !== "page" && value) params.set(key, value);
    }
    params.set("page", String(targetPage));
    return `${basePath}?${params.toString()}`;
  }

  const prevPage = Math.max(1, page - 1);
  const nextPage = Math.min(totalPages, page + 1);

  return (
    <div className="mt-6 flex items-center justify-center gap-3">
      <Link
        href={hrefFor(prevPage)}
        aria-disabled={page <= 1}
        tabIndex={page <= 1 ? -1 : undefined}
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
        href={hrefFor(nextPage)}
        aria-disabled={page >= totalPages}
        tabIndex={page >= totalPages ? -1 : undefined}
        className={`rounded-lg border border-rule px-3 py-1.5 text-sm ${
          page >= totalPages ? "pointer-events-none opacity-40" : "text-ink hover:bg-white"
        }`}
      >
        Next
      </Link>
    </div>
  );
}