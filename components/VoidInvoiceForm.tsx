"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { voidInvoice } from "@/lib/actions/fees";

export function VoidInvoiceForm({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!reason.trim()) {
      setError("Enter a reason for voiding this invoice.");
      return;
    }

    startTransition(async () => {
      try {
        await voidInvoice(invoiceId, reason);
        setReason("");
        setOpen(false);
        router.refresh();
      } catch (err: any) {
        setError(err.message ?? "Something went wrong.");
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-clay hover:underline"
      >
        Void invoice
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-paper p-2"
    >
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (required)"
        className="w-48 rounded-lg border border-rule px-2 py-1 text-xs"
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-clay px-2 py-1 text-xs font-medium text-white hover:bg-clay/90 disabled:opacity-60"
      >
        {isPending ? "Voiding…" : "Confirm void"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-xs text-ink-soft hover:underline"
      >
        Cancel
      </button>
      {error && <p className="w-full text-xs text-clay">{error}</p>}
    </form>
  );
}
