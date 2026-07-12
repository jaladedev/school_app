"use client";

import { useState } from "react";
import Link from "next/link";
import { CreateLessonForm } from "@/components/CreateLessonForm";

export function LessonEntryRow({
  entryId,
  classId,
  subjectName,
  className,
  periodNumber,
  startTime,
  endTime,
  room,
  lessonId,
  topics,
}: {
  entryId: string;
  classId: string;
  subjectName: string;
  className: string;
  periodNumber: number;
  startTime: string;
  endTime: string;
  room: string | null;
  lessonId: string | null;
  topics: { id: string; title: string }[];
}) {
  const [logging, setLogging] = useState(false);

  return (
    <div className="rounded-lg border border-rule bg-white px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-ink">
            {subjectName} — {className}
          </p>
          <p className="text-sm text-ink-soft">
            Period {periodNumber} · {startTime}–{endTime}
            {room ? ` · Room ${room}` : ""}
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
          <button
            onClick={() => setLogging((prev) => !prev)}
            className="rounded-lg border border-leaf px-3 py-1.5 text-sm font-medium text-leaf hover:bg-leaf-soft"
          >
            {logging ? "Close" : "Log lesson"}
          </button>
        )}
      </div>

      {logging && !lessonId && (
        <CreateLessonForm
          timetableEntryId={entryId}
          classId={classId}
          topics={topics}
          onClose={() => setLogging(false)}
        />
      )}
    </div>
  );
}