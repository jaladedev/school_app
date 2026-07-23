import { createClient } from "@/lib/supabase/server";
import { getLinkedChildren, resolveSelectedChild } from "@/lib/parent";
import { ChildSwitcher } from "@/components/ChildSwitcher";
import type { AttendanceStatus } from "@/types/database";

export default async function ParentAttendancePage({
  searchParams,
}: {
  searchParams: { child?: string };
}) {
  const children = await getLinkedChildren();
  const selected = await resolveSelectedChild(searchParams.child);

  if (!selected) {
    return <p className="text-sm text-ink-soft">No children linked to your account.</p>;
  }

  const supabase = createClient();

  const { data: rows } = await supabase
    .from("attendance")
    .select("status, marked_at, lessons(lesson_date, timetable_entries(subjects(name)))")
    .eq("student_id", selected.id)
    .order("marked_at", { ascending: false })
    .limit(100);

  const summary: Record<AttendanceStatus, number> = {
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
  };
  for (const r of rows ?? []) {
    const status = r.status as AttendanceStatus;
    summary[status] += 1;
  }
  const total = rows?.length ?? 0;
  const percent = total > 0 ? Math.round((summary.present / total) * 1000) / 10 : null;

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">Attendance</h1>
      <ChildSwitcher linkedChildren={children} selectedChildId={selected.id} />

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
          Overall attendance rate: <span className="font-medium text-ink">{percent}%</span> across{" "}
          {total} recorded lessons.
        </p>
      )}

      <div className="space-y-2">
        {rows?.map((r, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-lg border border-rule bg-white px-4 py-3 text-sm"
          >
            <div>
              <p className="text-ink">{r.lessons?.timetable_entries?.subjects?.name ?? "Lesson"}</p>
              <p className="text-xs text-ink-soft">{r.lessons?.lesson_date}</p>
            </div>
            <span className="capitalize text-ink-soft">{r.status}</span>
          </div>
        ))}

        {!rows?.length && <p className="text-sm text-ink-soft">No attendance records yet.</p>}
      </div>
    </div>
  );
}
