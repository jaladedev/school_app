import Link from "next/link";

// Covers any unmatched route outside /dashboard (a bad public URL, a
// mistyped /login path, etc.). Lower stakes than app/dashboard/not-found.tsx
// since there's no dashboard chrome to lose here, but this still swaps
// Next's bare default 404 for something branded and gives a way back in.
export default function RootNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-paper px-4 text-center">
      <p className="mb-2 font-display text-xl font-semibold text-ink">Page not found</p>
      <p className="mb-6 max-w-sm text-sm text-ink-soft">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>
      <Link
        href="/"
        className="rounded-lg bg-marigold px-4 py-2 text-sm font-medium text-ink hover:bg-marigold-dark"
      >
        Back home
      </Link>
    </div>
  );
}
