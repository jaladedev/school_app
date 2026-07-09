import Link from "next/link";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";

const WEEKDAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default async function TeacherHome() {
  const profile = await getCurrentProfile();
  const supabase = createClient();

  const today = new Date();
  const todayWeekday = today.getDay() === 0 ? 7 : today.getDay(); // 1=Mon..7=Sun

  const { data: todaysEntries } = await supabase
    .from("timetable_entries")
    .select("*, classes(name, arm), subjects(name)")
    .eq("teacher_id", profile!.id)
    .eq("weekday", todayWeekday)
    .order("period_number", { ascending: true });

  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, timetable_entry_id")
    .eq("teacher_id", profile!.id)
    .eq("lesson_date", today.toISOString().slice(0, 10));

  const lessonByEntry = new Map(
    (lessons ?? []).map((l) => [l.timetable_entry_id, l.id])
  );

  // Distinct classes taught, from timetable
  const { data: allEntries } = await supabase
    .from("timetable_entries")
    .select("class_id, classes(name, arm, grade_level), subjects(name)")
    .eq("teacher_id", profile!.id);

  const classMap = new Map<string, { name: string; arm: string | null; grade_level: number; subjects: Set<string> }>();
  for (const e of allEntries ?? []) {
    const cls = (e as any).classes;
    const subj = (e as any).subjects;
    if (!cls) continue;
    const key = e.class_id;
    if (!classMap.has(key)) {
      classMap.set(key, { name: cls.name, arm: cls.arm, grade_level: cls.grade_level, subjects: new Set() });
    }
    if (subj?.name) classMap.get(key)!.subjects.add(subj.name);
  }

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">
        {WEEKDAY_NAMES[todayWeekday]}'s lessons
      </h1>
      <p className="mb-6 text-sm text-ink-soft">
        Mark attendance for a lesson, or jump to a class below.
      </p>

      <div className="mb-10 space-y-2">
        {todaysEntries?.map((entry) => {
          const lessonId = lessonByEntry.get(entry.id);
          const cls = (entry as any).classes;
          const subj = (entry as any).subjects;
          return (
            <div
              key={entry.id}
              className="flex items-center justify-between rounded-lg border border-rule bg-white px-4 py-3"
            >
              <div>
                <p className="font-medium text-ink">
                  {subj?.name} — {cls?.name} {cls?.arm}
                </p>
                <p className="text-sm text-ink-soft">
                  Period {entry.period_number} · {entry.start_time}–{entry.end_time}
                  {entry.room ? ` · Room ${entry.room}` : ""}
                </p>
              </div>
              {lessonId ? (
                <Link
                  href={`/dashboard/teacher/attendance/${lessonId}`}
                  className="rounded-lg bg-marigold px-3 py-1.5 text-sm font-medium text-ink hover:bg-marigold-dark"
                >
                  Mark attendance
                </Link>
              ) : (
                <span className="text-sm text-ink-soft">No lesson logged yet</span>
              )}
            </div>
          );
        })}

        {!todaysEntries?.length && (
          <p className="text-sm text-ink-soft">No lessons scheduled for today.</p>
        )}
      </div>

      <h2 className="mb-3 font-display text-lg font-semibold text-ink">My classes</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {[...classMap.entries()].map(([classId, cls]) => (
          <div key={classId} className="rounded-xl border border-rule bg-white p-5">
            <p className="font-display text-lg font-semibold text-ink">
              {cls.name} {cls.arm}
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              {[...cls.subjects].join(", ")}
            </p>
            <div className="mt-3 flex gap-3 text-sm">
              <Link href="/dashboard/teacher/notes" className="text-leaf hover:underline">
                Notes
              </Link>
              <Link href="/dashboard/teacher/grades" className="text-leaf hover:underline">
                Grades
              </Link>
            </div>
          </div>
        ))}

        {!classMap.size && (
          <p className="col-span-full text-sm text-ink-soft">
            No classes assigned yet — ask an admin to add you to the timetable.
          </p>
        )}
      </div>
    </div>
  );
}
