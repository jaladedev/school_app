"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { EditTeacherSubjectsForm } from "@/components/EditTeacherSubjectsForm";
import { ResetPasswordButton } from "@/components/ResetPasswordButton";
import { DeactivateUserButton } from "@/components/DeactivateUserButton";
import { updateTeacherAccount, updateTeacherStaffRole } from "@/lib/actions/admin";
import type { PickableSubject } from "@/components/SubjectPicker";
import type { StaffRole } from "@/types/database";

export function TeacherRow({
  teacherId,
  fullName,
  email,
  isActive,
  subjectNames,
  currentSubjectIds,
  allSubjects,
  staffRole,
}: {
  teacherId: string;
  fullName: string;
  email: string;
  isActive: boolean;
  subjectNames: string[];
  currentSubjectIds: string[];
  allSubjects: PickableSubject[];
  staffRole: StaffRole;
}) {
  const router = useRouter();
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(fullName);
  const [isPending, startTransition] = useTransition();
  const [isRoleSaving, startRoleTransition] = useTransition();

  function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await updateTeacherAccount({ teacherId, fullName: nameValue });
      setEditingName(false);
      router.refresh();
    });
  }

  function handleStaffRoleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const nextRole = e.target.value as StaffRole;
    startRoleTransition(async () => {
      await updateTeacherStaffRole(teacherId, nextRole);
      router.refresh();
    });
  }

  return (
    <div
      className={`rounded-lg border border-rule bg-white px-4 py-3 ${!isActive ? "opacity-60" : ""}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
              {!isActive && (
                <span className="ml-2 text-xs font-normal text-clay">(deactivated)</span>
              )}{" "}
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
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={staffRole}
            onChange={handleStaffRoleChange}
            disabled={isRoleSaving}
            aria-label={`Staff role for ${fullName}`}
            className="rounded-lg border border-rule bg-white px-2 py-1 text-xs font-medium text-ink outline-none focus-visible:border-marigold disabled:opacity-60"
          >
            <option value="teacher">Teacher</option>
            <option value="hod">HOD</option>
            <option value="bursar">Bursar</option>
          </select>
          <ResetPasswordButton userId={teacherId} />
          <DeactivateUserButton userId={teacherId} isActive={isActive} />
          <EditTeacherSubjectsForm
            teacherId={teacherId}
            currentSubjectIds={currentSubjectIds}
            allSubjects={allSubjects}
          />
          <Link
            href={`/dashboard/admin/id-cards/print?type=staff&teacherId=${teacherId}`}
            className="text-xs font-medium text-leaf hover:underline"
          >
            Print ID Card
          </Link>
        </div>
      </div>
    </div>
  );
}
