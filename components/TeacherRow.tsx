"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { EditTeacherSubjectsForm } from "@/components/EditTeacherSubjectsForm";
import { ResetPasswordButton } from "@/components/ResetPasswordButton";
import { DeactivateUserButton } from "@/components/DeactivateUserButton";
import { updateTeacherAccount } from "@/lib/actions/admin";

export function TeacherRow({
  teacherId,
  fullName,
  email,
  isActive,
  subjectNames,
  currentSubjectIds,
  allSubjects,
}: {
  teacherId: string;
  fullName: string;
  email: string;
  isActive: boolean;
  subjectNames: string[];
  currentSubjectIds: string[];
  allSubjects: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [editingSubjects, setEditingSubjects] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(fullName);
  const [isPending, startTransition] = useTransition();

  function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await updateTeacherAccount({ teacherId, fullName: nameValue });
      setEditingName(false);
      router.refresh();
    });
  }

  return (
    <div className={`rounded-lg border border-rule bg-white px-4 py-3 ${!isActive ? "opacity-60" : ""}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          {editingName ? (
            <form onSubmit={handleSaveName} className="flex items-center gap-2">
              <input
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                className="rounded-lg border border-rule px-2 py-1 text-sm outline-none focus-visible:border-marigold"
                autoFocus
              />
              <button
                type="submit"
                disabled={isPending}
                className="text-xs font-medium text-leaf hover:underline"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingName(false);
                  setNameValue(fullName);
                }}
                className="text-xs text-ink-soft hover:underline"
              >
                Cancel
              </button>
            </form>
          ) : (
            <p className="font-medium text-ink">
              <Link href={`/dashboard/admin/staff/${teacherId}`} className="hover:underline">
                {fullName}
              </Link>
              {!isActive && <span className="ml-2 text-xs font-normal text-clay">(deactivated)</span>}{" "}
              <button
                onClick={() => setEditingName(true)}
                className="text-xs font-normal text-ink-soft hover:underline"
              >
                edit
              </button>
            </p>
          )}
          <p className="text-sm text-ink-soft">{email}</p>
          <p className="mt-1 text-xs text-ink-soft">
            {subjectNames.length ? subjectNames.join(", ") : "No subjects assigned"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ResetPasswordButton userId={teacherId} />
          <DeactivateUserButton userId={teacherId} isActive={isActive} />
          <button
            onClick={() => setEditingSubjects((prev) => !prev)}
            className="text-sm font-medium text-leaf hover:underline"
          >
            {editingSubjects ? "Close" : "Edit subjects"}
          </button>
        </div>
      </div>

      {editingSubjects && (
        <EditTeacherSubjectsForm
          teacherId={teacherId}
          currentSubjectIds={currentSubjectIds}
          allSubjects={allSubjects}
          onClose={() => setEditingSubjects(false)}
        />
      )}
    </div>
  );
}