"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { returnLibraryLoan } from "@/lib/actions/library";
import { formatKobo } from "@/types/database";

export function ReturnLoanButton({ loanId }: { loanId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ overdueDays: number; fineKobo: number } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleReturn() {
    setError(null);
    startTransition(async () => {
      try {
        const outcome = await returnLibraryLoan(loanId);
        setResult(outcome);
        // The row is about to disappear from the active-loans list once
        // this refreshes (it's no longer "active"), so give the fine
        // confirmation a moment to actually be read first.
        setTimeout(() => router.refresh(), 3000);
      } catch (err: any) {
        setError(err.message ?? "Something went wrong.");
      }
    });
  }

  if (result) {
    return (
      <p className="text-xs text-ink-soft">
        Returned.{" "}
        {result.fineKobo > 0
          ? `${result.overdueDays} day${result.overdueDays === 1 ? "" : "s"} overdue — a fine of ${formatKobo(result.fineKobo)} was added to their invoices.`
          : result.overdueDays > 0
            ? `${result.overdueDays} day${result.overdueDays === 1 ? "" : "s"} overdue (no fine rate set).`
            : "On time."}
      </p>
    );
  }

  return (
    <div>
      <button
        onClick={handleReturn}
        disabled={isPending}
        className="rounded-md bg-leaf-soft px-2.5 py-1 text-xs font-medium text-leaf hover:bg-leaf hover:text-white disabled:opacity-60"
      >
        {isPending ? "Recording…" : "Mark returned"}
      </button>
      {error && <p className="mt-1 text-xs text-clay">{error}</p>}
    </div>
  );
}
