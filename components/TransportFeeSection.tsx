"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createTransportFeeStructure,
  voidTransportFeeStructure,
  generateTransportInvoices,
} from "@/lib/actions/transportFees";
import { emitToast } from "@/lib/toast";
import { formatKobo } from "@/types/database";

type FeeStructure = {
  id: string;
  title: string;
  amount_kobo: number;
  term: number;
  academic_year: string;
  voided_at: string | null;
};

export function TransportFeeSection({
  routeId,
  feeStructures,
  defaultTerm,
  defaultAcademicYear,
}: {
  routeId: string;
  feeStructures: FeeStructure[];
  defaultTerm: number;
  defaultAcademicYear: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amountNaira, setAmountNaira] = useState("");
  const [term, setTerm] = useState(defaultTerm);
  const [academicYear, setAcademicYear] = useState(defaultAcademicYear);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const active = feeStructures.filter((f) => !f.voided_at);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const naira = Number(amountNaira);
    if (!naira || naira <= 0) return setError("Enter a valid amount.");

    startTransition(async () => {
      try {
        await createTransportFeeStructure({
          routeId,
          term,
          academicYear,
          amountKobo: Math.round(naira * 100),
        });
        emitToast("Transport fee added.");
        setAmountNaira("");
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  function handleVoid(id: string) {
    startTransition(async () => {
      try {
        await voidTransportFeeStructure(id);
        emitToast("Fee voided.");
        router.refresh();
      } catch (err) {
        emitToast(err instanceof Error ? err.message : "Something went wrong.", "error");
      }
    });
  }

  function handleGenerate(id: string) {
    startTransition(async () => {
      try {
        const result = await generateTransportInvoices(id);
        emitToast(
          result.created
            ? `${result.created} invoice${result.created === 1 ? "" : "s"} created.`
            : "Everyone currently on this route already has an invoice."
        );
        router.refresh();
      } catch (err) {
        emitToast(err instanceof Error ? err.message : "Something went wrong.", "error");
      }
    });
  }

  return (
    <div className="rounded-xl border border-rule bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-ink">Transport fee</p>
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="rounded-lg border border-rule px-3 py-1.5 text-sm font-medium text-ink hover:bg-leaf-soft"
          >
            + Add fee
          </button>
        )}
      </div>

      {active.length > 0 ? (
        <div className="space-y-2">
          {active.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between rounded-lg border border-rule px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium text-ink">{f.title}</p>
                <p className="text-xs text-ink-soft">
                  {formatKobo(f.amount_kobo)} · Term {f.term} · {f.academic_year}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleGenerate(f.id)}
                  disabled={isPending}
                  className="rounded-lg bg-leaf px-3 py-1.5 text-xs font-medium text-white hover:bg-leaf/90 disabled:opacity-60"
                >
                  Generate invoices
                </button>
                <button
                  onClick={() => handleVoid(f.id)}
                  disabled={isPending}
                  className="rounded-lg border border-rule px-3 py-1.5 text-xs text-ink-soft hover:bg-paper disabled:opacity-60"
                >
                  Void
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        !open && <p className="text-sm text-ink-soft">No transport fee set for this route yet.</p>
      )}

      {open && (
        <form
          onSubmit={handleCreate}
          className="mt-3 flex flex-wrap items-start gap-2 border-t border-rule pt-3"
        >
          <input
            type="number"
            min={1}
            step="0.01"
            required
            placeholder="Amount (₦)"
            value={amountNaira}
            onChange={(e) => setAmountNaira(e.target.value)}
            className="w-32 rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
          />
          <input
            type="number"
            min={1}
            max={3}
            value={term}
            onChange={(e) => setTerm(Number(e.target.value))}
            className="w-20 rounded-lg border border-rule px-3 py-2 text-sm"
          />
          <input
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            placeholder="2026/2027"
            className="w-32 rounded-lg border border-rule px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-leaf px-3 py-2 text-sm font-medium text-white hover:bg-leaf/90 disabled:opacity-60"
          >
            {isPending ? "Adding…" : "Add"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg border border-rule px-3 py-2 text-sm text-ink-soft"
          >
            Cancel
          </button>
          {error && <p className="w-full text-sm text-clay">{error}</p>}
        </form>
      )}
    </div>
  );
}
