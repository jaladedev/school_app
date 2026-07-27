"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { StudentTypeahead, type StudentOption } from "@/components/StudentTypeahead";
import { assignStudentToRoom, joinHostelWaitlist } from "@/lib/actions/hostel";
import { emitToast } from "@/lib/toast";

export function AssignStudentForm({
  roomId,
  hostelId,
  students,
}: {
  roomId: string;
  hostelId: string;
  students: StudentOption[];
}) {
  const router = useRouter();
  const [studentId, setStudentId] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [roomFull, setRoomFull] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setRoomFull(false);
    if (!studentId) {
      setError("Pick a student first.");
      return;
    }
    if (!academicYear.trim()) {
      setError("Academic year is required (e.g. 2026/2027).");
      return;
    }

    startTransition(async () => {
      try {
        await assignStudentToRoom({ studentId, roomId, academicYear: academicYear.trim() });
        emitToast("Student assigned.");
        setStudentId("");
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Something went wrong.";
        setError(message);
        if (message === "This room is already at capacity.") setRoomFull(true);
      }
    });
  }

  function handleJoinWaitlist() {
    startTransition(async () => {
      try {
        await joinHostelWaitlist(studentId, hostelId);
        emitToast("Added to the waitlist.");
        setError(null);
        setRoomFull(false);
        setStudentId("");
        router.refresh();
      } catch (err) {
        emitToast(err instanceof Error ? err.message : "Something went wrong.", "error");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-start gap-2">
      <div className="min-w-[220px] flex-1">
        <StudentTypeahead students={students} value={studentId} onChange={setStudentId} />
      </div>
      <input
        placeholder="Academic year (e.g. 2026/2027)"
        value={academicYear}
        onChange={(e) => setAcademicYear(e.target.value)}
        className="rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-leaf px-3 py-2 text-sm font-medium text-white hover:bg-leaf/90 disabled:opacity-60"
      >
        {isPending ? "Assigning…" : "Assign"}
      </button>
      {error && (
        <div className="w-full">
          <p className="text-sm text-clay">{error}</p>
          {roomFull && studentId && (
            <button
              type="button"
              onClick={handleJoinWaitlist}
              disabled={isPending}
              className="mt-1 rounded-lg border border-rule px-3 py-1.5 text-xs font-medium text-ink hover:bg-leaf-soft disabled:opacity-60"
            >
              Room&apos;s full — add this student to the hostel waitlist instead
            </button>
          )}
        </div>
      )}
    </form>
  );
}
