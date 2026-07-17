"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveAssessmentGrades } from "@/lib/actions/gradesModeration";

export function ApproveAssessmentButton({ assessmentId }: { assessmentId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleApprove() {
    startTransition(async () => {
      await approveAssessmentGrades(assessmentId);
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleApprove}
      disabled={isPending}
      className="rounded-lg bg-leaf px-3 py-1.5 text-sm font-medium text-white hover:bg-leaf/90 disabled:opacity-60"
    >
      {isPending ? "Approving…" : "Approve all pending"}
    </button>
  );
}
