"use client";

import { downloadCsv } from "@/lib/csv";
import type { AttendanceStatus } from "@/types/database";

export function ExportAttendanceRegisterButton({
  lessonDate,
  className,
  students,
  statuses,
}: {
  lessonDate: string;
  className: string;
  students: { id: string; full_name: string }[];
  statuses: Record<string, AttendanceStatus>;
}) {
  function handleExport() {
    const safeClassName = className.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    downloadCsv(
      `attendance-${safeClassName}-${lessonDate}.csv`,
      ["Student", "Status", "Lesson date", "Class"],
      students.map((student) => [
        student.full_name,
        statuses[student.id] ?? "present",
        lessonDate,
        className,
      ])
    );
  }

  return (
    <button
      onClick={handleExport}
      className="rounded-lg border border-rule px-3 py-1.5 text-sm text-ink hover:bg-paper"
    >
      Export register CSV
    </button>
  );
}
