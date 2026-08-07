"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setReportCardApproval } from "@/lib/actions/reportCard";
import { emitToast } from "@/lib/toast";

export function ApproveReportCardButton({
  studentId,
  term,
  academicYear,
  isApproved,
}: {
  studentId: string;
  term: number;
  academicYear: string;
  isApproved: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      try {
        await setReportCardApproval({
          studentId,
          term,
          academicYear,
          approved: !isApproved,
        });
        emitToast(isApproved ? "Report card unapproved." : "Report card approved and released.");
        router.refresh();
      } catch (err: any) {
        emitToast(err.message ?? "Something went wrong.", "error");
      }
    });
  }

  return (
    <div className="mt-3 flex items-center gap-3">
      <button
        onClick={handleToggle}
        disabled={isPending}
        className={
          isApproved
            ? "rounded-lg border border-clay/40 px-3 py-2 text-sm font-medium text-clay hover:bg-clay/5 disabled:opacity-60"
            : "rounded-lg bg-leaf px-3 py-2 text-sm font-medium text-white hover:bg-leaf/90 disabled:opacity-60"
        }
      >
        {isPending
          ? isApproved
            ? "Unapproving…"
            : "Approving…"
          : isApproved
            ? "Revoke approval"
            : "Approve & release to student"}
      </button>

      {isApproved && (
        <span className="flex items-center gap-1 text-xs text-leaf">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="h-3.5 w-3.5"
          >
            <path
              fillRule="evenodd"
              d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z"
              clipRule="evenodd"
            />
          </svg>
          Approved — visible to student
        </span>
      )}
    </div>
  );
}
