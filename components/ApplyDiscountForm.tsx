"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyDiscount } from "@/lib/actions/fees";
import { formatKobo } from "@/types/database";

export function ApplyDiscountForm({
  invoiceId,
  totalAmountKobo,
  currentDiscountKobo,
}: {
  invoiceId: string;
  totalAmountKobo: number;
  currentDiscountKobo: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [discountNaira, setDiscountNaira] = useState(
    currentDiscountKobo > 0 ? String(currentDiscountKobo / 100) : ""
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Blank input means "no discount" (0), same as clearing a waiver —
    // not an error, unlike RecordPaymentForm where a blank/zero amount
    // wouldn't make sense.
    const naira = discountNaira.trim() === "" ? 0 : parseFloat(discountNaira);
    if (isNaN(naira) || naira < 0) {
      setError("Enter a valid amount (0 or more).");
      return;
    }

    const discountKobo = Math.round(naira * 100);
    if (discountKobo > totalAmountKobo) {
      setError(`Discount can't exceed the invoice total (${formatKobo(totalAmountKobo)}).`);
      return;
    }

    startTransition(async () => {
      try {
        await applyDiscount(invoiceId, discountKobo);
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
        className="text-xs font-medium text-marigold-text hover:underline"
      >
        {currentDiscountKobo > 0 ? "Edit scholarship/discount" : "Apply scholarship/discount"}
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-paper p-2"
    >
      <input
        type="number"
        step="0.01"
        min="0"
        value={discountNaira}
        onChange={(e) => setDiscountNaira(e.target.value)}
        placeholder="Discount (₦)"
        className="w-28 rounded-lg border border-rule px-2 py-1 text-xs"
      />
      <span className="text-xs text-ink-soft">of {formatKobo(totalAmountKobo)} total</span>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-marigold px-2 py-1 text-xs font-medium text-white hover:bg-marigold/90 disabled:opacity-60"
      >
        {isPending ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          setError(null);
          setDiscountNaira(currentDiscountKobo > 0 ? String(currentDiscountKobo / 100) : "");
        }}
        className="text-xs text-ink-soft hover:underline"
      >
        Cancel
      </button>
      {error && <p className="w-full text-xs text-clay">{error}</p>}
    </form>
  );
}
