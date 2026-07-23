export function AttendanceHistoryChart({
  lessons,
}: {
  lessons: { id: string; lessonDate: string; present: number; total: number }[];
}) {
  if (!lessons.length) return null;

  return (
    <section className="mb-8 rounded-xl border border-rule bg-white p-4">
      <div className="mb-3">
        <h2 className="font-display text-lg font-semibold text-ink">Recent attendance</h2>
        <p className="text-sm text-ink-soft">Present students across your last eight lessons.</p>
      </div>
      <div className="flex h-32 items-end gap-2 border-b border-rule pb-1">
        {lessons.map((lesson) => {
          const percent = lesson.total ? Math.round((lesson.present / lesson.total) * 100) : 0;
          return (
            <div
              key={lesson.id}
              className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
            >
              <span className="text-[10px] font-medium text-ink-soft">{percent}%</span>
              <div
                className="w-full max-w-9 rounded-t bg-leaf transition"
                style={{ height: `${Math.max(percent, 3)}%` }}
                title={`${lesson.lessonDate}: ${lesson.present}/${lesson.total} present`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-2">
        {lessons.map((lesson) => (
          <span key={lesson.id} className="min-w-0 flex-1 text-center text-[10px] text-ink-soft">
            {new Date(`${lesson.lessonDate}T00:00:00`).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </span>
        ))}
      </div>
    </section>
  );
}
