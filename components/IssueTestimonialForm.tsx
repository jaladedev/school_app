"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { issueTestimonial } from "@/lib/actions/testimonials";
import { emitToast } from "@/lib/toast";

export function IssueTestimonialForm({
  studentId,
  defaultLeavingYear,
}: {
  studentId: string;
  defaultLeavingYear: string;
}) {
  const router = useRouter();
  const [conductRemark, setConductRemark] = useState("");
  const [leavingYear, setLeavingYear] = useState(defaultLeavingYear);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!conductRemark.trim()) {
      setError("A conduct remark is required.");
      return;
    }

    startTransition(async () => {
      try {
        await issueTestimonial({
          studentId,
          conductRemark,
          leavingAcademicYear: leavingYear,
        });
        emitToast("Testimonial issued.");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-lg space-y-3 rounded-xl border border-rule bg-white p-4"
    >
      <p className="text-sm text-ink-soft">
        This is a one-time issuance — once submitted, the testimonial&apos;s wording is locked in and can
        only be reprinted, not edited, so it stays consistent with whatever copy has already been
        handed out.
      </p>

      <label className="block text-sm">
        <span className="mb-1 block text-ink-soft">Leaving session</span>
        <input
          value={leavingYear}
          onChange={(e) => setLeavingYear(e.target.value)}
          placeholder="e.g. 2025/2026"
          className="w-full rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-ink-soft">Conduct &amp; character remark</span>
        <textarea
          value={conductRemark}
          onChange={(e) => setConductRemark(e.target.value)}
          rows={4}
          placeholder="e.g. She has been punctual, of good conduct, and diligent in her studies throughout her time here."
          className="w-full rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
        />
      </label>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-leaf px-3 py-2 text-sm font-medium text-white hover:bg-leaf/90 disabled:opacity-60"
      >
        {isPending ? "Issuing…" : "Issue testimonial"}
      </button>

      {error && <p className="text-sm text-clay">{error}</p>}
    </form>
  );
}
