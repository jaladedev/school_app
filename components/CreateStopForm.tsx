"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createStop } from "@/lib/actions/transport";
import { emitToast } from "@/lib/toast";

export function CreateStopForm({
  routeId,
  nextSequence,
}: {
  routeId: string;
  nextSequence: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [approxTime, setApproxTime] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Stop name is required.");
      return;
    }

    startTransition(async () => {
      try {
        await createStop({
          routeId,
          name,
          sequenceOrder: nextSequence,
          approxTime: approxTime || undefined,
        });
        emitToast("Stop added.");
        setName("");
        setApproxTime("");
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-rule px-3 py-1.5 text-sm font-medium text-ink hover:bg-leaf-soft"
      >
        + Add stop
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-start gap-2">
      <input
        required
        placeholder="Stop name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
      />
      <input
        type="time"
        value={approxTime}
        onChange={(e) => setApproxTime(e.target.value)}
        className="rounded-lg border border-rule px-3 py-2 text-sm"
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
  );
}
