import Link from "next/link";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Pagination, DEFAULT_PAGE_SIZE, parsePage, pageRange } from "@/components/Pagination";
import { EmptyState } from "@/components/EmptyState";
import { AttendanceHistoryChart } from "@/components/AttendanceHistoryChart";

type LessonRowData = {
  id: string;
  lesson_date: string;
  classes: { name: string; arm: string | null } | null;
  curriculum_topics: { title: string; subject_id: string } | null;
};

export default async function AttendanceLandingPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }
  const supabase = createClient();

  const today = new Date().toISOString().slice(0, 10);
  const page = parsePage(searchParams.page);
  const { from, to } = pageRange(page, DEFAULT_PAGE_SIZE);

  const { data: todaysLessons } = await supabase
    .from("lessons")
    .select("*, classes(name, arm), curriculum_topics(title, subject_id)")
    .eq("teacher_id", profile.id)
    .eq("lesson_date", today)
    .order("id", { ascending: true })
    .returns<LessonRowData[]>();

  const { data: pastLessons, count } = await supabase
    .from("lessons")
    .select("*, classes(name, arm), curriculum_topics(title, subject_id)", { count: "exact" })
    .eq("teacher_id", profile.id)
    .neq("lesson_date", today)
    .order("lesson_date", { ascending: false })
    .range(from, to)
    .returns<LessonRowData[]>();

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / DEFAULT_PAGE_SIZE));

  const allLessons = [...(todaysLessons ?? []), ...(pastLessons ?? [])];

  // Pull subject names in a second query since curriculum_topics doesn't embed subjects directly here.
  const subjectIds = [
    ...new Set(
      allLessons.map((l) => l.curriculum_topics?.subject_id).filter((id): id is string => !!id)
    ),
  ];

  const { data: subjects } = subjectIds.length
    ? await supabase.from("subjects").select("id, name").in("id", subjectIds)
    : { data: [] };

  const subjectNameById = new Map((subjects ?? []).map((s) => [s.id, s.name]));

  // Attendance-marked status per lesson, so the list shows what's done vs pending.
  const lessonIds = allLessons.map((l) => l.id);
  const { data: attendanceRows } = lessonIds.length
    ? await supabase.from("attendance").select("lesson_id").in("lesson_id", lessonIds)
    : { data: [] };

  const markedLessonIds = new Set((attendanceRows ?? []).map((a) => a.lesson_id));

  const { data: historyLessons } = await supabase
    .from("lessons")
    .select("id, lesson_date")
    .eq("teacher_id", profile.id)
    .order("lesson_date", { ascending: false })
    .limit(8);

  const historyLessonIds = (historyLessons ?? []).map((lesson) => lesson.id);
  const { data: historyAttendance } = historyLessonIds.length
    ? await supabase
        .from("attendance")
        .select("lesson_id, status")
        .in("lesson_id", historyLessonIds)
    : { data: [] };

  const attendanceByLesson = new Map<string, { present: number; total: number }>();
  for (const row of historyAttendance ?? []) {
    const current = attendanceByLesson.get(row.lesson_id) ?? { present: 0, total: 0 };
    current.total += 1;
    if (row.status === "present" || row.status === "late") current.present += 1;
    attendanceByLesson.set(row.lesson_id, current);
  }

  const history = (historyLessons ?? [])
    .map((lesson) => ({
      id: lesson.id,
      lessonDate: lesson.lesson_date,
      ...(attendanceByLesson.get(lesson.id) ?? { present: 0, total: 0 }),
    }))
    .reverse();

  function LessonRow({ lesson }: { lesson: LessonRowData }) {
    const subjectName = subjectNameById.get(lesson.curriculum_topics?.subject_id ?? "") ?? "Lesson";
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
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">Attendance</h1>
      <p className="mb-6 text-sm text-ink-soft">Select a lesson to mark or review attendance.</p>

      <AttendanceHistoryChart lessons={history} />

      <h2 className="mb-3 font-display text-lg font-semibold text-ink">Today</h2>
      <div className="mb-8 space-y-2">
        {(todaysLessons ?? []).map((lesson) => (
          <LessonRow key={lesson.id} lesson={lesson} />
        ))}
        {!todaysLessons?.length && (
          <p className="text-sm text-ink-soft">No lessons logged for today yet.</p>
        )}
      </div>

      <h2 className="mb-3 font-display text-lg font-semibold text-ink">Recent</h2>
      <div className="space-y-2">
        {(pastLessons ?? []).map((lesson) => (
          <LessonRow key={lesson.id} lesson={lesson} />
        ))}
        {!pastLessons?.length && <EmptyState message="No earlier lessons found." />}
      </div>

      <Pagination basePath="/dashboard/teacher/attendance" page={page} totalPages={totalPages} />
    </div>
  );
}
