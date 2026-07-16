export function PageLoader({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 animate-[fadeIn_150ms_ease-out]">
      <div className="relative h-10 w-10">
        <div className="absolute inset-0 rounded-full border-2 border-rule" />
        <div
          role="status"
          aria-label={label ?? "Loading"}
          className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-marigold border-r-marigold/40"
        />
      </div>
      <p className="text-sm text-ink-soft">{label ?? "Loading…"}</p>
    </div>
  );
}