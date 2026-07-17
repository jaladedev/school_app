"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateInvoicesForClass } from "@/lib/actions/fees";

export function GenerateInvoicesButton({
  feeStructureId,
  classes,
}: {
  feeStructureId: string;
  classes: { id: string; name: string; arm: string | null }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleGenerate() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await generateInvoicesForClass(feeStructureId, classId);
        setMessage(
          result.created > 0
            ? `Created ${result.created} invoice(s).`
            : "All students in this class already have an invoice for this fee."
        );
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
        Generate invoices →
      </button>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-paper p-2">
      <select
        value={classId}
        onChange={(e) => setClassId(e.target.value)}
        className="rounded-lg border border-rule px-2 py-1 text-xs"
      >
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} {c.arm}
          </option>
        ))}
      </select>
      <button
        onClick={handleGenerate}
        disabled={isPending}
        className="rounded-lg bg-leaf px-2 py-1 text-xs font-medium text-white hover:bg-leaf/90 disabled:opacity-60"
      >
        {isPending ? "Generating…" : "Generate"}
      </button>
      <button onClick={() => setOpen(false)} className="text-xs text-ink-soft hover:underline">
        Cancel
      </button>
      {message && <p className="w-full text-xs text-leaf">{message}</p>}
      {error && <p className="w-full text-xs text-clay">{error}</p>}
    </div>
  );
}
