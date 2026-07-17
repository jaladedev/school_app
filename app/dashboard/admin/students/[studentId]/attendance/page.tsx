import { createClient } from "@/lib/supabase/server";
import type { AttendanceStatus } from "@/types/database";
import { EmptyState } from "@/components/EmptyState";

export default async function StudentAttendancePage({
  params,
}: {
  params: { studentId: string };
}) {
  const supabase = createClient();

  const { data: rows } = await supabase
    .from("attendance")
    .select("status, marked_at, lessons(lesson_date, classes(name, arm), curriculum_topics(title))")
    .eq("student_id", params.studentId)
    .order("marked_at", { ascending: false })
    .limit(100);

  const summary: Record<AttendanceStatus, number> = { present: 0, absent: 0, late: 0, excused: 0 };
    for (const r of rows ?? []) {
    const status = r.status as AttendanceStatus;
    summary[status] += 1;
    }
  const total = rows?.length ?? 0;
  const percent = total > 0 ? Math.round((summary.present / total) * 1000) / 10 : null;

  return (
    <div>

      <h1 className="mb-6 font-display text-2xl font-semibold text-ink">Attendance</h1>

      <div className="mb-6 grid grid-cols-4 gap-3">
        <div className="rounded-lg border border-rule bg-white p-4 text-center">
          <p className="font-display text-xl font-semibold text-leaf">{summary.present}</p>
          <p className="text-xs text-ink-soft">Present</p>
        </div>
        <div className="rounded-lg border border-rule bg-white p-4 text-center">
          <p className="font-display text-xl font-semibold text-clay">{summary.absent}</p>
          <p className="text-xs text-ink-soft">Absent</p>
        </div>
        <div className="rounded-lg border border-rule bg-white p-4 text-center">
          <p className="font-display text-xl font-semibold text-marigold-dark">{summary.late}</p>
          <p className="text-xs text-ink-soft">Late</p>
        </div>
        <div className="rounded-lg border border-rule bg-white p-4 text-center">
          <p className="font-display text-xl font-semibold text-ink">{summary.excused}</p>
          <p className="text-xs text-ink-soft">Excused</p>
        </div>
      </div>

      {percent !== null && (
        <p className="mb-6 text-sm text-ink-soft">
          Overall attendance rate: <span className="font-medium text-ink">{percent}%</span>{" "}
          across {total} recorded lessons.
        </p>
      )}

      <div className="space-y-2">
        {rows?.map((r: any, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-lg border border-rule bg-white px-4 py-3 text-sm"
          >
            <div>
              <p className="text-ink">
                {r.lessons?.classes?.name} {r.lessons?.classes?.arm}
                {r.lessons?.curriculum_topics?.title ? ` — ${r.lessons.curriculum_topics.title}` : ""}
              </p>
              <p className="text-xs text-ink-soft">{r.lessons?.lesson_date}</p>
            </div>
            <span className="capitalize text-ink-soft">{r.status}</span>
          </div>
        ))}

        {!rows?.length && (
          <EmptyState message="No attendance records yet." />
        )}
      </div>
    </div>
  );
}