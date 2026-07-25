"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createHostelRoom } from "@/lib/actions/hostel";
import { emitToast } from "@/lib/toast";

export function CreateHostelRoomForm({ hostelId }: { hostelId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [roomNumber, setRoomNumber] = useState("");
  const [capacity, setCapacity] = useState("4");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!roomNumber.trim()) {
      setError("Room number is required.");
      return;
    }

    startTransition(async () => {
      try {
        await createHostelRoom({ hostelId, roomNumber, capacity: Number(capacity) });
        emitToast("Room added.");
        setRoomNumber("");
        setCapacity("4");
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
        + Add room
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-start gap-2">
      <input
        required
        placeholder="Room no. (e.g. A-12)"
        value={roomNumber}
        onChange={(e) => setRoomNumber(e.target.value)}
        className="rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
      />
      <input
        type="number"
        min={1}
        value={capacity}
        onChange={(e) => setCapacity(e.target.value)}
        className="w-24 rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
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
