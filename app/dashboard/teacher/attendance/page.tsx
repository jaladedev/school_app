import Link from "next/link";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";

export default async function AttendanceLandingPage() {
  const profile = await getCurrentProfile();
  const supabase = createClient();

  const today = new Date().toISOString().slice(0, 10);

  const { data: lessons } = await supabase
    .from("lessons")
    .select("*, classes(name, arm), curriculum_topics(title, subject_id), timetable_entry_id")
    .eq("teacher_id", profile!.id)
    .order("lesson_date", { ascending: false })
    .limit(30);

  // Pull subject names in a second query since curriculum_topics doesn't embed subjects directly here.
  const subjectIds = [
    ...new Set(
      (lessons ?? [])
        .map((l: any) => l.curriculum_topics?.subject_id)
        .filter(Boolean)
    ),
  ];

  const { data: subjects } = subjectIds.length
    ? await supabase.from("subjects").select("id, name").in("id", subjectIds)
    : { data: [] };

  const subjectNameById = new Map((subjects ?? []).map((s) => [s.id, s.name]));

  // Attendance-marked status per lesson, so the list shows what's done vs pending.
  const lessonIds = (lessons ?? []).map((l) => l.id);
  const { data: attendanceRows } = lessonIds.length
    ? await supabase.from("attendance").select("lesson_id").in("lesson_id", lessonIds)
    : { data: [] };

  const markedLessonIds = new Set((attendanceRows ?? []).map((a) => a.lesson_id));

  const todaysLessons = (lessons ?? []).filter((l) => l.lesson_date === today);
  const pastLessons = (lessons ?? []).filter((l) => l.lesson_date !== today);

  function LessonRow({ lesson }: { lesson: any }) {
    const subjectName = subjectNameById.get(lesson.curriculum_topics?.subject_id) ?? "Lesson";
    const marked = markedLessonIds.has(lesson.id);

    return (
      <Link
        href={`/dashboard/teacher/attendance/${lesson.id}`}
        className="flex items-center justify-between rounded-lg border border-rule bg-white px-4 py-3 transition hover:border-leaf"
      >
        <div>
          <p className="text-ink">
            {subjectName} — {lesson.classes?.name} {lesson.classes?.arm}
          </p>
          <p className="text-xs text-ink-soft">
            {lesson.lesson_date}
            {lesson.curriculum_topics?.title ? ` · ${lesson.curriculum_topics.title}` : ""}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            marked ? "bg-leaf-soft text-leaf" : "bg-marigold/20 text-marigold-dark"
          }`}
        >
          {marked ? "Marked" : "Pending"}
        </span>
      </Link>
    );
  }

  return (
    <div className="max-w-xl">
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">
        Attendance
      </h1>
      <p className="mb-6 text-sm text-ink-soft">
        Select a lesson to mark or review attendance.
      </p>

      <h2 className="mb-3 font-display text-lg font-semibold text-ink">Today</h2>
      <div className="mb-8 space-y-2">
        {todaysLessons.map((lesson) => (
          <LessonRow key={lesson.id} lesson={lesson} />
        ))}
        {!todaysLessons.length && (
          <p className="text-sm text-ink-soft">
            No lessons logged for today yet.
          </p>
        )}
      </div>

      <h2 className="mb-3 font-display text-lg font-semibold text-ink">Recent</h2>
      <div className="space-y-2">
        {pastLessons.map((lesson) => (
          <LessonRow key={lesson.id} lesson={lesson} />
        ))}
        {!pastLessons.length && (
          <p className="text-sm text-ink-soft">No earlier lessons found.</p>
        )}
      </div>
    </div>
  );
}