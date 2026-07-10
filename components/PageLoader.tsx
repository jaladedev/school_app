export function PageLoader({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
      <div
        role="status"
        aria-label={label ?? "Loading"}
        className="h-8 w-8 animate-spin rounded-full border-2 border-rule border-t-marigold"
      />
      {label && <p className="text-sm text-ink-soft">{label}</p>}
    </div>
  );
}