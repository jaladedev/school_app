"use client";

import { useState, useTransition } from "react";
import { createTeacherAccount } from "@/lib/actions/admin";
import { createTeacherSchema, fieldErrorsFrom } from "@/lib/validation";
import { SubjectPicker, type PickableSubject } from "@/components/SubjectPicker";
import type { StaffRole } from "@/types/database";

const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  teacher: "Teacher",
  hod: "HOD",
  bursar: "Bursar",
  librarian: "Librarian",
  house_parent: "House parent",
  transport_officer: "Transport officer",
  driver: "Driver",
};

// Only these two are assigned subjects -- every other staff role
// doesn't teach, so the subject picker is hidden (and not required)
// for them. Keep in sync with the isTeachingRole check in
// createTeacherAccount (lib/actions/admin.ts).
const TEACHING_ROLES: StaffRole[] = ["teacher", "hod"];

export function CreateTeacherForm({ subjects }: { subjects: PickableSubject[] }) {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [staffRole, setStaffRole] = useState<StaffRole>("teacher");
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<string | null>(null);

  const isTeachingRole = TEACHING_ROLES.includes(staffRole);

  function toggleSubject(id: string) {
    setSubjectIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreated(null);

    const input = {
      fullName,
      email,
      temporaryPassword,
      staffRole,
      subjectIds: isTeachingRole ? subjectIds : [],
    };
    const errors = fieldErrorsFrom(createTeacherSchema, input);
    if (errors) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    startTransition(async () => {
      try {
        await createTeacherAccount(input);
        setCreated(email);
        setFullName("");
        setEmail("");
        setTemporaryPassword("");
        setStaffRole("teacher");
        setSubjectIds([]);
      } catch (err: any) {
        setError(err.message ?? "Something went wrong.");
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-marigold px-4 py-2 text-sm font-medium text-ink hover:bg-marigold-dark"
      >
        + Add staff
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 space-y-3 rounded-xl border border-rule bg-white p-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <input
            placeholder="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
          />
          {fieldErrors.fullName && <p className="mt-1 text-xs text-clay">{fieldErrors.fullName}</p>}
        </div>
        <div>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
          />
          {fieldErrors.email && <p className="mt-1 text-xs text-clay">{fieldErrors.email}</p>}
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-soft">Role</p>
        <select
          value={staffRole}
          onChange={(e) => setStaffRole(e.target.value as StaffRole)}
          className="w-full rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
        >
          {(Object.keys(STAFF_ROLE_LABELS) as StaffRole[]).map((value) => (
            <option key={value} value={value}>
              {STAFF_ROLE_LABELS[value]}
            </option>
          ))}
        </select>
        {fieldErrors.staffRole && <p className="mt-1 text-xs text-clay">{fieldErrors.staffRole}</p>}
      </div>

      <div>
        <input
          type="text"
          placeholder="Temporary password (share with them directly)"
          value={temporaryPassword}
          onChange={(e) => setTemporaryPassword(e.target.value)}
          className="w-full rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
        />
        {fieldErrors.temporaryPassword && (
          <p className="mt-1 text-xs text-clay">{fieldErrors.temporaryPassword}</p>
        )}
      </div>

      {isTeachingRole && (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-soft">
            Subjects taught
          </p>
          <SubjectPicker subjects={subjects} selectedIds={subjectIds} onToggle={toggleSubject} />
          {fieldErrors.subjectIds && (
            <p className="mt-1 text-xs text-clay">{fieldErrors.subjectIds}</p>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-leaf px-3 py-2 text-sm font-medium text-white hover:bg-leaf/90 disabled:opacity-60"
        >
          {isPending ? "Creating…" : "Create account"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-rule px-3 py-2 text-sm text-ink-soft"
        >
          Cancel
        </button>
      </div>

      {error && <p className="text-sm text-clay">{error}</p>}
      {created && (
        <p className="text-sm text-leaf">
          Account created for {created}. Share the temporary password with them directly — it
          won&apos;t be shown again here.
        </p>
      )}
    </form>
  );
}
