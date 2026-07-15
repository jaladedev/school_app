import Link from "next/link";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { LessonEntryRow } from "@/components/LessonEntryRow";
import { redirect } from "next/navigation";

const WEEKDAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default async function TeacherHome() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }
  const supabase = createClient();

  const today = new Date();
  const todayWeekday = today.getDay() === 0 ? 7 : today.getDay();
  const todayDate = today.toISOString().slice(0, 10);

  const { data: todaysEntries } = await supabase
    .from("timetable_entries")
    .select("*, classes(id, name, arm, education_level, level_number), subjects(id, name)")
    .eq("teacher_id", profile.id)
    .eq("weekday", todayWeekday)
    .order("period_number", { ascending: true });

  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, timetable_entry_id")
    .eq("teacher_id", profile.id)
    .eq("lesson_date", todayDate);

  const lessonByEntry = new Map(
    (lessons ?? []).map((l) => [l.timetable_entry_id, l.id])
  );

  // Fetch curriculum topics for every (subject, education_level, level_number)
  // combination appearing in today's schedule, so each row's "Log lesson"
  // form can offer the right topic list without a query per row.
  const topicsByKey = new Map<string, { id: string; title: string }[]>();
  for (const entry of todaysEntries ?? []) {
    const subj = entry.subjects;
    const cls = entry.classes;
    if (!subj || !cls) continue;
    const key = `${subj.id}:${cls.education_level}:${cls.level_number}`;
    if (topicsByKey.has(key)) continue;

    const { data: topics } = await supabase
      .from("curriculum_topics")
      .select("id, title")
      .eq("subject_id", subj.id)
      .eq("education_level", cls.education_level)
      .eq("level_number", cls.level_number)
      .order("sequence_order", { ascending: true });

    topicsByKey.set(key, topics ?? []);
  }

  // Distinct classes taught, from timetable
  const { data: allEntries } = await supabase
    .from("timetable_entries")
    .select("class_id, classes(name, arm, education_level, level_number), subjects(name)")
    .eq("teacher_id", profile.id);

  const classMap = new Map<string, { name: string; arm: string | null; subjects: Set<string> }>();
  for (const e of allEntries ?? []) {
    const cls = e.classes;
    const subj = e.subjects;
    if (!cls) continue;
    const key = e.class_id;
    if (!classMap.has(key)) {
      classMap.set(key, { name: cls.name, arm: cls.arm, subjects: new Set() });
    }
    if (subj?.name) classMap.get(key)!.subjects.add(subj.name);
  }

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">
        {WEEKDAY_NAMES[todayWeekday]}'s lessons
      </h1>
      <p className="mb-6 text-sm text-ink-soft">
        Log a lesson to unlock attendance for that period, or jump to a class below.
      </p>

      <div className="mb-10 space-y-2">
        {todaysEntries?.map((entry) => {
          const subj = entry.subjects;
          const cls = entry.classes;
          const key = `${subj?.id}:${cls?.education_level}:${cls?.level_number}`;

          return (
            <LessonEntryRow
              key={entry.id}
              entryId={entry.id}
              classId={cls?.id}
              subjectName={subj?.name ?? ""}
              className={`${cls?.name ?? ""} ${cls?.arm ?? ""}`}
              periodNumber={entry.period_number}
              startTime={entry.start_time}
              endTime={entry.end_time}
              room={entry.room}
              lessonId={lessonByEntry.get(entry.id) ?? null}
              topics={topicsByKey.get(key) ?? []}
            />
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