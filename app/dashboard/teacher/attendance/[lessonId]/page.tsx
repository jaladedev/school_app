import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AttendanceForm } from "@/components/AttendanceForm";
import type { AttendanceStatus } from "@/types/database";
import { EmptyState } from "@/components/EmptyState";

export default async function AttendancePage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const resolvedParams = await params;

  const supabase = createClient();

  const { data: lesson } = await supabase
    .from("lessons")
    .select("*, classes(id, name, arm)")
    .eq("id", resolvedParams.lessonId)
    .single();

  const classId = lesson?.classes?.id;

  const { data: roster } = await supabase
    .from("student_profiles")
    .select("id, profiles(full_name)")
    .eq("class_id", classId ?? "");

  const students = (roster ?? [])
    .map((r: any) => ({ id: r.id, full_name: r.profiles?.full_name ?? "Unknown" }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  const { data: existing } = await supabase
    .from("attendance")
    .select("student_id, status")
    .eq("lesson_id", resolvedParams.lessonId);

  const initialStatus: Record<string, AttendanceStatus> = {};
  for (const row of existing ?? []) {
    initialStatus[row.student_id] = row.status;
  }

  const { data: previousLesson } = lesson
    ? await supabase
        .from("lessons")
        .select("id")
        .eq("teacher_id", lesson.teacher_id)
        .eq("class_id", lesson.class_id)
        .lt("lesson_date", lesson.lesson_date)
        .order("lesson_date", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const { data: previousAttendance } = previousLesson
    ? await supabase
        .from("attendance")
        .select("student_id, status")
        .eq("lesson_id", previousLesson.id)
    : { data: [] };

  const previousStatus: Record<string, AttendanceStatus> = {};
  for (const row of previousAttendance ?? []) {
    previousStatus[row.student_id] = row.status;
  }

  return (
    <div className="max-w-xl">
      <Link
        href="/dashboard/teacher/attendance"
        className="mb-2 inline-block text-sm text-leaf hover:underline"
      >
        ← Attendance
      </Link>
      <p className="mb-1 text-xs uppercase tracking-wide text-leaf">Attendance</p>
      <h1 className="mb-6 font-display text-2xl font-semibold text-ink">
        {lesson?.classes?.name} {lesson?.classes?.arm}
      </h1>

      {students.length ? (
        <AttendanceForm
          lessonId={resolvedParams.lessonId}
          students={students}
          initialStatus={initialStatus}
          previousStatus={previousLesson ? previousStatus : undefined}
          lessonDate={lesson?.lesson_date ?? "attendance"}
          className={`${lesson?.classes?.name ?? "Class"} ${lesson?.classes?.arm ?? ""}`.trim()}
        />
      ) : (
        <EmptyState message="No students found in this class." />
      )}
    </div>
  );
}
