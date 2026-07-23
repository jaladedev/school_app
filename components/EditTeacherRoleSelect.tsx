"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTeacherStaffRole } from "@/lib/actions/admin";
import type { StaffRole } from "@/types/database";

const LABELS: Record<StaffRole, string> = { teacher: "Teacher", hod: "HOD", bursar: "Bursar" };

export function EditTeacherRoleSelect({
  teacherId,
  currentRole,
}: {
  teacherId: string;
  currentRole: StaffRole;
}) {
  const router = useRouter();
  const [role, setRole] = useState(currentRole);
  const [isPending, startTransition] = useTransition();

  function handleChange(nextRole: StaffRole) {
    setRole(nextRole);
    startTransition(async () => {
      try {
        await updateTeacherStaffRole(teacherId, nextRole);
        router.refresh();
      } catch {
        setRole(currentRole);
      }
    });
  }

  return (
    <select
      value={role}
      onChange={(event) => handleChange(event.target.value as StaffRole)}
      disabled={isPending}
      aria-label="Staff role"
      className="rounded-lg border border-rule bg-white px-2 py-1 text-xs text-ink disabled:opacity-60"
    >
      {(Object.keys(LABELS) as StaffRole[]).map((value) => (
        <option key={value} value={value}>
          {LABELS[value]}
        </option>
      ))}
    </select>
  );
}
