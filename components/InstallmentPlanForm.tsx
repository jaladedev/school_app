"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createOrReplaceInstallmentPlan,
  deleteInstallmentPlan,
  type InstallmentInput,
} from "@/lib/actions/installments";
import { formatKobo } from "@/types/database";

type Row = { dueDate: string; amountNaira: string };

function emptyRow(): Row {
  return { dueDate: "", amountNaira: "" };
}

export function InstallmentPlanForm({
  invoiceId,
  netPayableKobo,
  hasExistingPlan,
  initialRows,
}: {
  invoiceId: string;
  netPayableKobo: number;
  hasExistingPlan: boolean;
  /** Pre-fill when editing an existing plan. */
  initialRows?: Row[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>(
    initialRows?.length ? initialRows : [emptyRow(), emptyRow()]
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const totalNaira = rows.reduce((sum, r) => sum + (parseFloat(r.amountNaira) || 0), 0);
  const netPayableNaira = netPayableKobo / 100;
  const diffNaira = Math.round((totalNaira - netPayableNaira) * 100) / 100;

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(index: number) {
    setRows((prev) => (prev.length > 2 ? prev.filter((_, i) => i !== index) : prev));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed: InstallmentInput[] = [];
    for (const row of rows) {
      if (!row.dueDate) {
        setError("Every installment needs a due date.");
        return;
      }
      const naira = parseFloat(row.amountNaira);
      if (isNaN(naira) || naira <= 0) {
        setError("Every installment amount must be a positive number.");
        return;
      }
      parsed.push({ dueDate: row.dueDate, amountKobo: Math.round(naira * 100) });
    }

    if (diffNaira !== 0) {
      setError(
        diffNaira > 0
          ? `Installments total ₦${diffNaira.toFixed(2)} more than the invoice's net payable amount.`
          : `Installments total ₦${Math.abs(diffNaira).toFixed(2)} less than the invoice's net payable amount.`
      );
      return;
    }

    startTransition(async () => {
      try {
        await createOrReplaceInstallmentPlan(invoiceId, parsed);
        setOpen(false);
        router.refresh();
      } catch (err: any) {
        setError(err.message ?? "Something went wrong.");
      }
    });
  }

  function handleRemovePlan() {
    setError(null);
    startTransition(async () => {
      try {
        await deleteInstallmentPlan(invoiceId);
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
        {hasExistingPlan ? "Edit installment plan" : "Set up installment plan"}
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 rounded-lg bg-paper p-3">
      <div className="mb-2 space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="date"
              value={row.dueDate}
              onChange={(e) => updateRow(i, { dueDate: e.target.value })}
              className="rounded-lg border border-rule px-2 py-1 text-xs"
            />
            <input
              type="number"
              step="0.01"
              min="0"
              value={row.amountNaira}
              onChange={(e) => updateRow(i, { amountNaira: e.target.value })}
              placeholder="Amount (₦)"
              className="w-28 rounded-lg border border-rule px-2 py-1 text-xs"
            />
            {rows.length > 2 && (
              <button
                type="button"
                onClick={() => removeRow(i)}
                className="text-xs text-clay hover:underline"
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mb-2 flex items-center gap-3">
        <button
          type="button"
          onClick={addRow}
          className="text-xs font-medium text-leaf hover:underline"
        >
          + Add installment
        </button>
        <span className={`text-xs ${diffNaira === 0 ? "text-ink-soft" : "text-clay"}`}>
          Total ₦{totalNaira.toFixed(2)} of {formatKobo(netPayableKobo)} owed
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-marigold px-3 py-1.5 text-xs font-medium text-white hover:bg-marigold/90 disabled:opacity-60"
        >
          {isPending ? "Saving…" : hasExistingPlan ? "Save changes" : "Create plan"}
        </button>
        {hasExistingPlan && (
          <button
            type="button"
            onClick={handleRemovePlan}
            disabled={isPending}
            className="text-xs text-clay hover:underline disabled:opacity-60"
          >
            Remove plan
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-ink-soft hover:underline"
        >
          Cancel
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-clay">{error}</p>}
    </form>
  );
}
