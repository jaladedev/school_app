import Link from "next/link";

// Covers routes under /dashboard with no matching page.tsx (mistyped URL,
// stale bookmark, a removed route). Because /dashboard itself is a valid
// matched segment, Next renders this inside dashboard/layout.tsx's chrome
// for any unmatched child route, rather than falling through to the root/
// global default 404 (which has no dashboard sidebar/breadcrumbs).
//
// Not the same failure mode as an error.tsx case: nothing threw here,
// there's just no page for this URL. No "reset" callback exists for
// not-found.tsx (there's nothing to retry), so this only offers a way
// back rather than a retry button.
export default function DashboardNotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <p className="mb-2 font-display text-xl font-semibold text-ink">Page not found</p>
      <p className="mb-6 max-w-sm text-sm text-ink-soft">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>
      <Link
        href="/dashboard"
        className="rounded-lg bg-marigold px-4 py-2 text-sm font-medium text-ink hover:bg-marigold-dark"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
