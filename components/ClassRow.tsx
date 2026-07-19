"use client";

import { useState } from "react";
import Link from "next/link";
import { AssignClassTeacherSelect } from "@/components/AssignClassTeacherSelect";
import { EditClassForm } from "@/components/EditClassForm";
import { ExportClassListButton } from "@/components/ExportClassListButton";
import { formatLevel, type EducationLevel } from "@/types/database";

export function ClassRow({
  classId,
  name,
  arm,
  educationLevel,
  levelNumber,
  academicYear,
  isArchived,
  studentCount,
  subjectsScheduledCount,
  periodsPerWeek,
  currentTeacherId,
  teachers,
}: {
  classId: string;
  name: string;
  arm: string | null;
  educationLevel: EducationLevel;
  levelNumber: number;
  academicYear: string;
  isArchived: boolean;
  studentCount: number;
  subjectsScheduledCount: number;
  periodsPerWeek: number;
  currentTeacherId: string | null;
  teachers: { id: string; full_name: string }[];
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="rounded-lg border border-rule bg-white px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-ink">
            {name} {arm}
          </p>
          <p className="text-sm text-ink-soft">
            {formatLevel(educationLevel, levelNumber)} · {academicYear} · {studentCount} students
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="mb-1 text-xs text-ink-soft">Class teacher</p>
            <AssignClassTeacherSelect
              classId={classId}
              currentTeacherId={currentTeacherId}
              teachers={teachers}
            />
          </div>
          <button
            onClick={() => setEditing((prev) => !prev)}
            className="text-sm font-medium text-leaf hover:underline"
          >
            {editing ? "Close" : "Edit"}
          </button>
          <ExportClassListButton classId={classId} className={`${name} ${arm ?? ""}`} />
          <Link
            href={`/dashboard/admin/timetables/${classId}`}
            className="text-sm font-medium text-leaf hover:underline"
          >
            View timetable →
          </Link>
        </div>
      </div>

      <p className="mt-2 text-xs text-ink-soft">
        {periodsPerWeek > 0 ? (
          <>
            {subjectsScheduledCount} subject{subjectsScheduledCount === 1 ? "" : "s"} scheduled ·{" "}
            {periodsPerWeek} period{periodsPerWeek === 1 ? "" : "s"}/week
          </>
        ) : (
          <span className="text-marigold-dark">Not scheduled yet</span>
        )}
      </p>

      {editing && (
        <EditClassForm
          classId={classId}
          currentName={name}
          currentArm={arm}
          currentAcademicYear={academicYear}
          isArchived={isArchived}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
