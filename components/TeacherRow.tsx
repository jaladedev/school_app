"use client";

import { useState } from "react";
import { EditTeacherSubjectsForm } from "@/components/EditTeacherSubjectsForm";

export function TeacherRow({
  teacherId,
  fullName,
  email,
  subjectNames,
  currentSubjectIds,
  allSubjects,
}: {
  teacherId: string;
  fullName: string;
  email: string;
  subjectNames: string[];
  currentSubjectIds: string[];
  allSubjects: { id: string; name: string }[];
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="rounded-lg border border-rule bg-white px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-ink">{fullName}</p>
          <p className="text-sm text-ink-soft">{email}</p>
          <p className="mt-1 text-xs text-ink-soft">
            {subjectNames.length ? subjectNames.join(", ") : "No subjects assigned"}
          </p>
        </div>
        <button
          onClick={() => setEditing((prev) => !prev)}
          className="text-sm font-medium text-leaf hover:underline"
        >
          {editing ? "Close" : "Edit subjects"}
        </button>
      </div>

      {editing && (
        <EditTeacherSubjectsForm
          teacherId={teacherId}
          currentSubjectIds={currentSubjectIds}
          allSubjects={allSubjects}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}