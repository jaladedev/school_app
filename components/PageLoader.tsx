export function PageLoader({ label }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4 py-10 backdrop-blur-sm">
      <div className="mx-auto w-full max-w-sm overflow-hidden rounded-[2rem] border border-slate-200/70 bg-white/95 p-8 shadow-2xl shadow-slate-900/20">
        <div className="flex items-center justify-center">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-marigold/20 to-amber-100">
            <span className="absolute inset-0 rounded-full border border-marigold/20" />
            <span
              role="status"
              aria-live="polite"
              aria-label={label ?? "Loading"}
              className="h-10 w-10 animate-spin rounded-full border-4 border-b-marigold/40 border-l-marigold/40 border-r-transparent border-t-marigold"
            />
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-lg font-semibold text-ink">{label ?? "Loading…"}</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">Preparing your page.</p>
        </div>
      </div>
    </div>
  );
}
