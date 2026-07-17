"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveReportCardRemark } from "@/lib/actions/reportCard";

export function RemarkForm({
  studentId,
  term,
  academicYear,
  initialClassTeacherRemark,
  initialAdminRemark,
}: {
  studentId: string;
  term: number;
  academicYear: string;
  initialClassTeacherRemark: string | null;
  initialAdminRemark: string | null;
}) {
  const router = useRouter();
  const [classTeacherRemark, setClassTeacherRemark] = useState(initialClassTeacherRemark ?? "");
  const [adminRemark, setAdminRemark] = useState(initialAdminRemark ?? "");
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await saveReportCardRemark({
          studentId,
          term,
          academicYear,
          classTeacherRemark,
          adminRemark,
        });
        setSaved(true);
        router.refresh();
      } catch (err: any) {
        setError(err.message ?? "Something went wrong.");
      }
    });
  }

  return (
    <div className="mt-4 rounded-xl border border-rule bg-white p-4">
      <p className="mb-3 text-sm font-medium text-ink">Edit remarks</p>

      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-soft">
        Class teacher&apos;s remark
      </label>
      <textarea
        value={classTeacherRemark}
        onChange={(e) => setClassTeacherRemark(e.target.value)}
        rows={2}
        className="mb-3 w-full rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
      />

      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-soft">
        Head teacher&apos;s / admin remark
      </label>
      <textarea
        value={adminRemark}
        onChange={(e) => setAdminRemark(e.target.value)}
        rows={2}
        className="mb-3 w-full rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
      />

      <button
        onClick={handleSave}
        disabled={isPending}
        className="rounded-lg bg-leaf px-3 py-2 text-sm font-medium text-white hover:bg-leaf/90 disabled:opacity-60"
      >
        {isPending ? "Saving…" : "Save remarks"}
      </button>

      {saved && <p className="mt-2 text-sm text-leaf">Saved.</p>}
      {error && <p className="mt-2 text-sm text-clay">{error}</p>}
    </div>
  );
}
