"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { waiveLibraryFine } from "@/lib/actions/library";

export function WaiveFineButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [waived, setWaived] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleWaive() {
    setError(null);
    startTransition(async () => {
      try {
        await waiveLibraryFine(invoiceId, reason || undefined);
        setWaived(true);
        setOpen(false);
        setTimeout(() => router.refresh(), 2000);
      } catch (err: any) {
        setError(err.message ?? "Something went wrong.");
      }
    });
  }

  if (waived) {
    return <p className="text-xs text-leaf">Waived.</p>;
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-clay hover:underline"
      >
        Waive
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (optional)"
        className="w-40 rounded-md border border-rule px-2 py-1 text-xs outline-none focus-visible:border-marigold"
      />
      <button
        onClick={handleWaive}
        disabled={isPending}
        className="rounded-md bg-clay px-2 py-1 text-xs font-medium text-white hover:bg-clay/90 disabled:opacity-60"
      >
        {isPending ? "Waiving…" : "Confirm waive"}
      </button>
      <button onClick={() => setOpen(false)} className="text-xs text-ink-soft hover:underline">
        Cancel
      </button>
      {error && <p className="text-xs text-clay">{error}</p>}
    </div>
  );
}
