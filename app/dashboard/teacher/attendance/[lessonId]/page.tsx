import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AttendanceForm } from "@/components/AttendanceForm";
import type { AttendanceStatus } from "@/types/database";
import { EmptyState } from "@/components/EmptyState";

export default async function AttendancePage({ params }: { params: { lessonId: string } }) {
  const supabase = createClient();

  const { data: lesson } = await supabase
    .from("lessons")
    .select("*, classes(id, name, arm)")
    .eq("id", params.lessonId)
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
    .eq("lesson_id", params.lessonId);

  const initialStatus: Record<string, AttendanceStatus> = {};
  for (const row of existing ?? []) {
    initialStatus[row.student_id] = row.status;
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
          lessonId={params.lessonId}
          students={students}
          initialStatus={initialStatus}
        />
      ) : (
        <EmptyState message="No students found in this class." />
      )}
    </div>
  );
}
