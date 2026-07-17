"use client";

import { useEffect, useState, useTransition } from "react";
import { createStudentAccount } from "@/lib/actions/admin";
import { createStudentSchema, fieldErrorsFrom } from "@/lib/validation";

export function CreateStudentForm({
  classes,
}: {
  classes: { id: string; name: string; arm: string | null }[];
}) {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [admissionNo, setAdmissionNo] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<string | null>(null);

  useEffect(() => {
    if (!classes.length) {
      if (classId !== "") setClassId("");
      return;
    }
    const stillValid = classes.some((c) => c.id === classId);
    if (!stillValid) {
      setClassId(classes[0].id);
    }
  }, [classes, classId]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreated(null);

    const input = {
      fullName,
      email,
      temporaryPassword,
      classId,
      admissionNo: admissionNo || undefined,
      guardianName: guardianName || undefined,
      guardianPhone: guardianPhone || undefined,
    };

    const errors = fieldErrorsFrom(createStudentSchema, input);
    if (errors) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    startTransition(async () => {
      try {
        await createStudentAccount(input);
        setCreated(email);
        setFullName("");
        setEmail("");
        setTemporaryPassword("");
        setAdmissionNo("");
        setGuardianName("");
        setGuardianPhone("");
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
        + Add student
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
        <input
          type="text"
          placeholder="Temporary password (share with parent/student directly)"
          value={temporaryPassword}
          onChange={(e) => setTemporaryPassword(e.target.value)}
          className="w-full rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
        />
        {fieldErrors.temporaryPassword && (
          <p className="mt-1 text-xs text-clay">{fieldErrors.temporaryPassword}</p>
        )}
      </div>

      <div>
        <select
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          className="w-full rounded-lg border border-rule px-3 py-2 text-sm"
        >
          {!classes.length && <option value="">No classes available</option>}
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} {c.arm}
            </option>
          ))}
        </select>
        {fieldErrors.classId && <p className="mt-1 text-xs text-clay">{fieldErrors.classId}</p>}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <input
          placeholder="Admission no. (optional)"
          value={admissionNo}
          onChange={(e) => setAdmissionNo(e.target.value)}
          className="rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
        />
        <input
          placeholder="Guardian name (optional)"
          value={guardianName}
          onChange={(e) => setGuardianName(e.target.value)}
          className="rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
        />
        <input
          placeholder="Guardian phone (optional)"
          value={guardianPhone}
          onChange={(e) => setGuardianPhone(e.target.value)}
          className="rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending || !classes.length || !classId}
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

      {!classes.length && (
        <p className="text-sm text-ink-soft">Create a class first before adding students.</p>
      )}
      {error && <p className="text-sm text-clay">{error}</p>}
      {created && (
        <p className="text-sm text-leaf">
          Account created for {created}. Share the temporary password with them directly —
          it won't be shown again here.
        </p>
      )}
    </form>
  );
}