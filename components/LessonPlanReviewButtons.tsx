"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveLessonPlan, rejectLessonPlan } from "@/lib/actions/lessonPlanModeration";

export function LessonPlanReviewButtons({ noteId }: { noteId: string }) {
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleApprove() {
    setError(null);
    startTransition(async () => {
      try {
        await approveLessonPlan(noteId);
        router.refresh();
      } catch (err: any) {
        setError(err.message ?? "Something went wrong.");
      }
    });
  }

  function handleReject() {
    setError(null);
    startTransition(async () => {
      try {
        await rejectLessonPlan(noteId, reason || undefined);
        setRejecting(false);
        router.refresh();
      } catch (err: any) {
        setError(err.message ?? "Something went wrong.");
      }
    });
  }

  if (rejecting) {
    return (
      <div className="flex items-center gap-2">
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for the teacher (optional)"
          className="w-48 rounded-md border border-rule px-2 py-1 text-xs outline-none focus-visible:border-marigold"
        />
        <button
          onClick={handleReject}
          disabled={isPending}
          className="rounded-md bg-clay px-2 py-1 text-xs font-medium text-white hover:bg-clay/90 disabled:opacity-60"
        >
          {isPending ? "Rejecting…" : "Confirm reject"}
        </button>
        <button
          onClick={() => setRejecting(false)}
          className="text-xs text-ink-soft hover:underline"
        >
          Cancel
        </button>
        {error && <p className="text-xs text-clay">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleApprove}
        disabled={isPending}
        className="rounded-lg bg-leaf px-3 py-1.5 text-sm font-medium text-white hover:bg-leaf/90 disabled:opacity-60"
      >
        {isPending ? "Approving…" : "Approve"}
      </button>
      <button
        onClick={() => setRejecting(true)}
        disabled={isPending}
        className="rounded-lg border border-clay px-3 py-1.5 text-sm font-medium text-clay hover:bg-clay/10 disabled:opacity-60"
      >
        Reject
      </button>
      {error && <p className="text-xs text-clay">{error}</p>}
    </div>
  );
}
