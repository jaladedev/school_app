"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <p className="mb-2 font-display text-xl font-semibold text-ink">Something went wrong</p>
      <p className="mb-6 max-w-sm text-sm text-ink-soft">
        {error.message || "An unexpected error occurred loading this page."}
      </p>
      <div className="flex gap-2">
        <button
          onClick={reset}
          className="rounded-lg bg-marigold px-4 py-2 text-sm font-medium text-ink hover:bg-marigold-dark"
        >
          Try again
        </button>
        <a
          href="/dashboard"
          className="rounded-lg border border-rule px-4 py-2 text-sm text-ink hover:bg-paper"
        >
          Back to dashboard
        </a>
      </div>
    </div>
  );
}
