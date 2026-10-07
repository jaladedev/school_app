"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveAssessmentGrades } from "@/lib/actions/gradesModeration";

export function ApproveAssessmentButton({ assessmentId }: { assessmentId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleApprove() {
    setError(null);
    startTransition(async () => {
      const result = await approveAssessmentGrades(assessmentId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleApprove}
        disabled={isPending}
        className="rounded-lg bg-leaf px-3 py-1.5 text-sm font-medium text-white hover:bg-leaf/90 disabled:opacity-60"
      >
        {isPending ? "Approving…" : "Approve all pending"}
      </button>
      {error && <p className="text-xs text-clay">{error}</p>}
    </div>
  );
}
