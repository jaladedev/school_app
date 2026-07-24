"use client";

import { useState, useTransition } from "react";
import { markAttendance } from "@/lib/actions/teacher";
import { emitToast } from "@/lib/toast";
import { ExportAttendanceRegisterButton } from "@/components/ExportAttendanceRegisterButton";
import type { AttendanceStatus } from "@/types/database";

const STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "late", label: "Late" },
  { value: "excused", label: "Excused" },
];

export function AttendanceForm({
  lessonId,
  students,
  initialStatus,
  previousStatus,
  lessonDate,
  className,
}: {
  lessonId: string;
  students: { id: string; full_name: string }[];
  initialStatus: Record<string, AttendanceStatus>;
  previousStatus?: Record<string, AttendanceStatus>;
  lessonDate: string;
  className: string;
}) {
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>(() => {
    const base: Record<string, AttendanceStatus> = {};
    for (const s of students) {
      base[s.id] = initialStatus[s.id] ?? "present";
    }
    return base;
  });
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function setAll(status: AttendanceStatus) {
    const next: Record<string, AttendanceStatus> = {};
    for (const s of students) next[s.id] = status;
    setStatuses(next);
  }

  function copyPreviousAttendance() {
    if (!previousStatus) return;
    setStatuses((current) => {
      const next = { ...current };
      for (const student of students) {
        if (previousStatus[student.id]) next[student.id] = previousStatus[student.id];
      }
      return next;
    });
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await markAttendance(
          lessonId,
          students.map((s) => ({ studentId: s.id, status: statuses[s.id] }))
        );
        emitToast("Attendance saved.");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unable to save attendance.";
        setError(message);
        emitToast(message, "error");
      }
    });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setAll("present")}
          className="rounded-lg border border-rule px-3 py-1.5 text-sm text-ink hover:bg-leaf-soft"
        >
          Mark all present
        </button>
        {previousStatus && (
          <button
            onClick={copyPreviousAttendance}
            className="rounded-lg border border-rule px-3 py-1.5 text-sm text-ink hover:bg-leaf-soft"
          >
            Copy last lesson
          </button>
        )}
        <ExportAttendanceRegisterButton
          lessonDate={lessonDate}
          className={className}
          students={students}
          statuses={statuses}
        />
      </div>

      <div className="space-y-2">
        {students.map((student) => (
          <div
            key={student.id}
            className="flex flex-col gap-2 rounded-lg border border-rule bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="text-ink">{student.full_name}</span>
            <div className="flex flex-wrap gap-1">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStatuses((prev) => ({ ...prev, [student.id]: opt.value }))}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    statuses[student.id] === opt.value
                      ? "bg-leaf text-white"
                      : "bg-paper text-ink-soft hover:bg-leaf-soft"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={isPending}
        className="mt-6 rounded-lg bg-marigold px-4 py-2 font-medium text-ink hover:bg-marigold-dark disabled:opacity-60"
      >
        {isPending ? "Saving…" : "Save attendance"}
      </button>
      {error && <p className="mt-2 text-sm text-clay">{error}</p>}
    </div>
  );
}
