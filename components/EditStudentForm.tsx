"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateStudentAccount } from "@/lib/actions/admin";
import { emitToast } from "@/lib/toast";

export function EditStudentForm({
  studentId,
  currentFullName,
  currentAdmissionNo,
  currentGuardianName,
  currentGuardianPhone,
  currentClassId,
  classes,
}: {
  studentId: string;
  currentFullName: string;
  currentAdmissionNo: string | null;
  currentGuardianName: string | null;
  currentGuardianPhone: string | null;
  currentClassId: string | null;
  classes: { id: string; name: string; arm: string | null }[];
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(currentFullName);
  const [admissionNo, setAdmissionNo] = useState(currentAdmissionNo ?? "");
  const [guardianName, setGuardianName] = useState(currentGuardianName ?? "");
  const [guardianPhone, setGuardianPhone] = useState(currentGuardianPhone ?? "");
  const [classId, setClassId] = useState(currentClassId ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        await updateStudentAccount({
          studentId,
          fullName,
          admissionNo: admissionNo || undefined,
          guardianName: guardianName || undefined,
          guardianPhone: guardianPhone || undefined,
          classId: classId !== currentClassId ? classId : undefined,
        });
        emitToast("Student updated.");
        router.refresh();
      } catch (err: any) {
        setError(err.message ?? "Something went wrong.");
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-lg space-y-3 rounded-xl border border-rule bg-white p-4"
    >
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-soft">
          Full name
        </label>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-soft">
          Class
        </label>
        <select
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          className="w-full rounded-lg border border-rule px-3 py-2 text-sm"
        >
          <option value="">Unassigned</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} {c.arm}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-soft">
            Admission no.
          </label>
          <input
            value={admissionNo}
            onChange={(e) => setAdmissionNo(e.target.value)}
            className="w-full rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-soft">
            Guardian name
          </label>
          <input
            value={guardianName}
            onChange={(e) => setGuardianName(e.target.value)}
            className="w-full rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-soft">
            Guardian phone
          </label>
          <input
            value={guardianPhone}
            onChange={(e) => setGuardianPhone(e.target.value)}
            className="w-full rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-marigold px-4 py-2 text-sm font-medium text-ink hover:bg-marigold-dark disabled:opacity-60"
      >
        {isPending ? "Saving…" : "Save changes"}
      </button>
      {error && <p className="mt-2 text-sm text-clay">{error}</p>}
    </form>
  );
}
