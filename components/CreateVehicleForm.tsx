"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createVehicle } from "@/lib/actions/transport";
import { emitToast } from "@/lib/toast";

export function CreateVehicleForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [plateNumber, setPlateNumber] = useState("");
  const [model, setModel] = useState("");
  const [capacity, setCapacity] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!plateNumber.trim() || !capacity) {
      setError("Plate number and capacity are required.");
      return;
    }

    startTransition(async () => {
      try {
        await createVehicle({
          plateNumber,
          model: model || undefined,
          capacity: Number(capacity),
          driverName: driverName || undefined,
          driverPhone: driverPhone || undefined,
        });
        emitToast("Vehicle added.");
        setPlateNumber("");
        setModel("");
        setCapacity("");
        setDriverName("");
        setDriverPhone("");
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
        className="rounded-lg bg-marigold px-4 py-2 text-sm font-medium text-ink hover:bg-marigold-dark"
      >
        + New vehicle
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-rule bg-white p-4">
      <div className="grid grid-cols-2 gap-3">
        <input
          required
          placeholder="Plate number"
          value={plateNumber}
          onChange={(e) => setPlateNumber(e.target.value)}
          className="rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
        />
        <input
          placeholder="Model (optional, e.g. Toyota Hiace)"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
        />
        <input
          type="number"
          min={1}
          required
          placeholder="Seating capacity"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          className="rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
        />
        <input
          placeholder="Driver name (optional)"
          value={driverName}
          onChange={(e) => setDriverName(e.target.value)}
          className="rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
        />
        <input
          placeholder="Driver phone (optional)"
          value={driverPhone}
          onChange={(e) => setDriverPhone(e.target.value)}
          className="col-span-2 rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-leaf px-3 py-2 text-sm font-medium text-white hover:bg-leaf/90 disabled:opacity-60"
        >
          {isPending ? "Adding…" : "Add vehicle"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-rule px-3 py-2 text-sm text-ink-soft"
        >
          Cancel
        </button>
      </div>

      {error && <p className="text-sm text-clay">{error}</p>}
    </form>
  );
}
