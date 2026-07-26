"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createRoute } from "@/lib/actions/transport";
import { emitToast } from "@/lib/toast";

export function CreateRouteForm({ vehicles }: { vehicles: { id: string; label: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }

    startTransition(async () => {
      try {
        await createRoute({
          name,
          description: description || undefined,
          vehicleId: vehicleId || undefined,
        });
        emitToast("Route added.");
        setName("");
        setDescription("");
        setVehicleId("");
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
        + New route
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-rule bg-white p-4">
      <div className="grid grid-cols-2 gap-3">
        <input
          required
          placeholder="Route name (e.g. Ikeja Route)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
        />
        <select
          value={vehicleId}
          onChange={(e) => setVehicleId(e.target.value)}
          className="rounded-lg border border-rule px-3 py-2 text-sm"
        >
          <option value="">No vehicle assigned yet</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
        <input
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="col-span-2 rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-leaf px-3 py-2 text-sm font-medium text-white hover:bg-leaf/90 disabled:opacity-60"
        >
          {isPending ? "Adding…" : "Add route"}
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
