"use client";

import { useEffect, useRef, useState } from "react";
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
  suggestedTopicId,
  isCurrent,
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
  suggestedTopicId?: string | null;
  isCurrent?: boolean;
}) {
  // Current period is opened for logging by default (if not already logged),
  // and scrolled into view -- but this is just a starting point. The teacher
  // can close it and open any other period instead; nothing here is locked.
  const [logging, setLogging] = useState(Boolean(isCurrent) && !lessonId);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isCurrent) {
      rowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
    // Only run on mount -- this is a one-time "bring the current period into
    // view" nudge, not something that should re-trigger on later renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={rowRef}
      className={`rounded-lg border bg-white px-4 py-3 ${
        isCurrent ? "border-leaf ring-1 ring-leaf" : "border-rule"
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-ink">
            {subjectName} — {className}
            {isCurrent && (
              <span className="ml-2 rounded-full bg-leaf-soft px-2 py-0.5 text-xs font-medium text-leaf">
                Now
              </span>
            )}
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
          suggestedTopicId={suggestedTopicId ?? null}
          onClose={() => setLogging(false)}
        />
      )}
    </div>
  );
}
