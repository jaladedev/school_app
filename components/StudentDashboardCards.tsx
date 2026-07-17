import Link from "next/link";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const WEEKDAY_NAMES = [
  "",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export async function StudentDashboardCards() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }
  const supabase = createClient();

  const { data: studentProfile } = await supabase
    .from("student_profiles")
    .select("class_id")
    .eq("id", profile.id)
    .single();

  const classId = studentProfile?.class_id;

  // Recent homework not yet marked reviewed.
  const { data: homework } = classId
    ? await supabase
        .from("lessons")
        .select("id, homework, homework_status, timetable_entries(subjects(name))")
        .eq("class_id", classId)
        .not("homework", "is", null)
        .eq("homework_status", "given")
        .order("lesson_date", { ascending: false })
        .limit(3)
    : { data: [] };

  // Attendance percentage across everything recorded.
  const { data: attendanceRows } = await supabase
    .from("attendance")
    .select("status")
    .eq("student_id", profile.id);

  const total = attendanceRows?.length ?? 0;
  const present = (attendanceRows ?? []).filter((r) => r.status === "present").length;
  const attendancePercent = total > 0 ? Math.round((present / total) * 100) : null;

  // Tomorrow's weekday in 1=Mon..7=Sun format. JS getDay() is 0=Sun..6=Sat.
  const jsToday = new Date().getDay();
  const jsTomorrow = (jsToday + 1) % 7;
  const tomorrowWeekday = jsTomorrow === 0 ? 7 : jsTomorrow; // 1-7, Mon-Sun
  const isWeekendTomorrow = tomorrowWeekday === 6 || tomorrowWeekday === 7;

  const { data: tomorrowEntries } =
    classId && !isWeekendTomorrow
      ? await supabase
          .from("timetable_entries")
          .select("period_number, start_time, subjects(name)")
          .eq("class_id", classId)
          .eq("weekday", tomorrowWeekday)
          .order("period_number", { ascending: true })
          .limit(4)
      : { data: [] };

  return (
    <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="rounded-xl border border-rule bg-white p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-soft">
          Homework due
        </p>
        {homework?.length ? (
          <div className="space-y-1">
            {homework.map((h: any) => (
              <p key={h.id} className="text-sm text-ink">
                {h.timetable_entries?.subjects?.name ?? "Lesson"}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-soft">Nothing pending.</p>
        )}
        <Link
          href="/dashboard/student/homework"
          className="mt-2 inline-block text-xs text-leaf hover:underline"
        >
          View all →
        </Link>
      </div>

      <div className="rounded-xl border border-rule bg-white p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-soft">Attendance</p>
        <p
          className={`font-display text-2xl font-semibold ${
            attendancePercent === null
              ? "text-ink-soft"
              : attendancePercent >= 90
                ? "text-leaf"
                : attendancePercent >= 75
                  ? "text-marigold-dark"
                  : "text-clay"
          }`}
        >
          {attendancePercent !== null ? `${attendancePercent}%` : "—"}
        </p>
        <p className="text-xs text-ink-soft">{total} lessons recorded</p>
      </div>

      <div className="rounded-xl border border-rule bg-white p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-soft">
          Tomorrow ({WEEKDAY_NAMES[tomorrowWeekday]})
        </p>
        {isWeekendTomorrow ? (
          <p className="text-sm text-ink-soft">No school tomorrow.</p>
        ) : tomorrowEntries?.length ? (
          <div className="space-y-1">
            {tomorrowEntries.map((e: any, i: number) => (
              <p key={i} className="text-sm text-ink">
                P{e.period_number} · {e.subjects?.name}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-soft">No periods scheduled.</p>
        )}
        <Link
          href="/dashboard/student/timetable"
          className="mt-2 inline-block text-xs text-leaf hover:underline"
        >
          Full timetable →
        </Link>
      </div>
    </div>
  );
}
