"use client";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-paper text-center px-4">
      <p className="mb-2 font-display text-xl font-semibold text-ink">
        Something went wrong
      </p>
      <p className="mb-6 max-w-sm text-sm text-ink-soft">
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        onClick={reset}
        className="rounded-lg bg-marigold px-4 py-2 text-sm font-medium text-ink hover:bg-marigold-dark"
      >
        Try again
      </button>
    </div>
  );
}