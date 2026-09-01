import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AttendanceForm } from "@/components/AttendanceForm";
import type { AttendanceStatus } from "@/types/database";
import { EmptyState } from "@/components/EmptyState";

export default async function AttendancePage({
  params,
}: {
  params: Promise<{ classId: string; date: string }>;
}) {
  const resolvedParams = await params;
  const { classId, date } = resolvedParams;

  const supabase = createClient();

  const { data: klass } = await supabase
    .from("classes")
    .select("id, name, arm")
    .eq("id", classId)
    .single();

  const { data: roster } = await supabase
    .from("student_profiles")
    .select("id, profiles(full_name)")
    .eq("class_id", classId);

  const students = (roster ?? [])
    .map((r: any) => ({ id: r.id, full_name: r.profiles?.full_name ?? "Unknown" }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  const { data: existing } = await supabase
    .from("attendance")
    .select("student_id, status")
    .eq("class_id", classId)
    .eq("date", date);

  const initialStatus: Record<string, AttendanceStatus> = {};
  for (const row of existing ?? []) {
    initialStatus[row.student_id] = row.status;
  }

  const { data: previousDay } = await supabase
    .from("attendance")
    .select("date")
    .eq("class_id", classId)
    .lt("date", date)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: previousAttendance } = previousDay
    ? await supabase
        .from("attendance")
        .select("student_id, status")
        .eq("class_id", classId)
        .eq("date", previousDay.date)
    : { data: [] };

  const previousStatus: Record<string, AttendanceStatus> = {};
  for (const row of previousAttendance ?? []) {
    previousStatus[row.student_id] = row.status;
  }

  const className = `${klass?.name ?? "Class"} ${klass?.arm ?? ""}`.trim();

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
        {className} — {date}
      </h1>

      {students.length ? (
        <AttendanceForm
          classId={classId}
          date={date}
          students={students}
          initialStatus={initialStatus}
          previousStatus={previousDay ? previousStatus : undefined}
          className={className}
        />
      ) : (
        <EmptyState message="No students found in this class." />
      )}
    </div>
  );
}
