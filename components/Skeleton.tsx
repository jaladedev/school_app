function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-rule/60 ${className}`}
      aria-hidden="true"
    />
  );
}

// Matches the subject/class card grids (student subjects page, admin
// classes overview) — a grid of bordered boxes with a title + subtitle line.
export function SkeletonCardGrid({ count = 6 }: { count?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="grid grid-cols-2 gap-4 sm:grid-cols-3"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-rule bg-white p-5">
          <SkeletonBlock className="mb-2 h-5 w-3/4" />
          <SkeletonBlock className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}

// Matches list-style pages — student roster, notes list, announcements,
// timetable entries — a stack of bordered rows with a title + meta line.
export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading" className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between rounded-lg border border-rule bg-white px-4 py-3"
        >
          <div className="flex-1">
            <SkeletonBlock className="mb-2 h-4 w-2/5" />
            <SkeletonBlock className="h-3 w-1/4" />
          </div>
          <SkeletonBlock className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

// Matches a single content page (topic notes, grade detail) — a title
// line followed by paragraph-shaped blocks.
export function SkeletonDocument() {
  return (
    <div role="status" aria-label="Loading" className="max-w-2xl">
      <SkeletonBlock className="mb-4 h-7 w-2/3" />
      <SkeletonBlock className="mb-2 h-4 w-full" />
      <SkeletonBlock className="mb-2 h-4 w-full" />
      <SkeletonBlock className="mb-6 h-4 w-4/5" />
      <SkeletonBlock className="h-32 w-full" />
    </div>
  );
}