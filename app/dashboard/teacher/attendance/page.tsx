import Link from "next/link";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AttendanceHistoryChart } from "@/components/AttendanceHistoryChart";
import { EmptyState } from "@/components/EmptyState";

export default async function AttendanceLandingPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }
  const supabase = createClient();

  const today = new Date().toISOString().slice(0, 10);

  const { data: myClass } = await supabase
    .from("classes")
    .select("id, name, arm")
    .eq("class_teacher_id", profile.id)
    .maybeSingle();

  if (!myClass) {
    return (
      <div className="max-w-xl">
        <h1 className="mb-1 font-display text-2xl font-semibold text-ink">Attendance</h1>
        <p className="mb-6 text-sm text-ink-soft">
          Attendance is taken by each class&apos;s class teacher.
        </p>
        <EmptyState message="You aren't assigned as a class teacher, so there's no attendance for you to mark." />
      </div>
    );
  }

  const className = `${myClass.name} ${myClass.arm ?? ""}`.trim();

  const { data: todayRows } = await supabase
    .from("attendance")
    .select("student_id")
    .eq("class_id", myClass.id)
    .eq("date", today);

  const markedToday = (todayRows?.length ?? 0) > 0;

  const { data: recentRows } = await supabase
    .from("attendance")
    .select("date, status")
    .eq("class_id", myClass.id)
    .order("date", { ascending: false })
    .limit(80);

  const byDate = new Map<string, { present: number; total: number }>();
  for (const row of recentRows ?? []) {
    const current = byDate.get(row.date) ?? { present: 0, total: 0 };
    current.total += 1;
    if (row.status === "present" || row.status === "late") current.present += 1;
    byDate.set(row.date, current);
  }

  const history = [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-8)
    .map(([date, counts]) => ({ id: date, lessonDate: date, ...counts }));

  const pastDates = [...byDate.keys()].filter((d) => d !== today).sort((a, b) => b.localeCompare(a));

  return (
    <div className="max-w-xl">
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">Attendance</h1>
      <p className="mb-6 text-sm text-ink-soft">{className} — one record per student per day.</p>

      <AttendanceHistoryChart lessons={history} />

      <h2 className="mb-3 font-display text-lg font-semibold text-ink">Today</h2>
      <div className="mb-8">
        <Link
          href={`/dashboard/teacher/attendance/${myClass.id}/${today}`}
          className="flex items-center justify-between rounded-lg border border-rule bg-white px-4 py-3 transition hover:border-leaf"
        >
          <div>
            <p className="text-ink">{className}</p>
            <p className="text-xs text-ink-soft">{today}</p>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              markedToday ? "bg-leaf-soft text-leaf" : "bg-marigold/20 text-marigold-text"
            }`}
          >
            {markedToday ? "Marked" : "Pending"}
          </span>
        </Link>
      </div>

      <h2 className="mb-3 font-display text-lg font-semibold text-ink">Recent</h2>
      <div className="space-y-2">
        {pastDates.map((date) => (
          <Link
            key={date}
            href={`/dashboard/teacher/attendance/${myClass.id}/${date}`}
            className="flex items-center justify-between rounded-lg border border-rule bg-white px-4 py-3 transition hover:border-leaf"
          >
            <span className="text-ink">{date}</span>
          </Link>
        ))}
        {!pastDates.length && <EmptyState message="No earlier attendance found." />}
      </div>
    </div>
  );
}
