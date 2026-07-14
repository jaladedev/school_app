"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordPayment } from "@/lib/actions/fees";
import type { PaymentMethod } from "@/types/database";

export function RecordPaymentForm({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amountNaira, setAmountNaira] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const naira = parseFloat(amountNaira);
    if (isNaN(naira) || naira <= 0) {
      setError("Enter a valid amount.");
      return;
    }

    startTransition(async () => {
      try {
        await recordPayment({
          invoiceId,
          amountKobo: Math.round(naira * 100),
          method,
          reference: reference || undefined,
        });
        setAmountNaira("");
        setReference("");
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
        className="text-xs font-medium text-leaf hover:underline"
      >
        Record payment
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-paper p-2">
      <input
        type="number"
        step="0.01"
        value={amountNaira}
        onChange={(e) => setAmountNaira(e.target.value)}
        placeholder="Amount (₦)"
        className="w-28 rounded-lg border border-rule px-2 py-1 text-xs"
      />
      <select
        value={method}
        onChange={(e) => setMethod(e.target.value as PaymentMethod)}
        className="rounded-lg border border-rule px-2 py-1 text-xs"
      >
        <option value="cash">Cash</option>
        <option value="bank_transfer">Bank transfer</option>
        <option value="card">Card</option>
        <option value="other">Other</option>
      </select>
      <input
        value={reference}
        onChange={(e) => setReference(e.target.value)}
        placeholder="Reference (optional)"
        className="w-32 rounded-lg border border-rule px-2 py-1 text-xs"
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-leaf px-2 py-1 text-xs font-medium text-white hover:bg-leaf/90 disabled:opacity-60"
      >
        {isPending ? "Saving…" : "Save"}
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