export function PageLoader({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] animate-[fadeIn_150ms_ease-out] flex-col items-center justify-center gap-4">
      <div className="relative h-10 w-10">
        <div className="absolute inset-0 rounded-full border-2 border-rule" />
        <div
          role="status"
          aria-label={label ?? "Loading"}
          className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-r-marigold/40 border-t-marigold"
        />
      </div>
      <p className="text-sm text-ink-soft">{label ?? "Loading…"}</p>
    </div>
  );
}
