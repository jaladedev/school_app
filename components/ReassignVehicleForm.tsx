"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reassignRouteVehicle } from "@/lib/actions/transport";
import { emitToast } from "@/lib/toast";

export function ReassignVehicleForm({
  routeId,
  currentVehicleId,
  vehicles,
}: {
  routeId: string;
  currentVehicleId: string | null;
  vehicles: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [vehicleId, setVehicleId] = useState(currentVehicleId ?? "");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await reassignRouteVehicle(routeId, vehicleId || null);
        emitToast("Vehicle updated.");
        router.refresh();
      } catch (err) {
        emitToast(err instanceof Error ? err.message : "Something went wrong.", "error");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <select
        value={vehicleId}
        onChange={(e) => setVehicleId(e.target.value)}
        className="rounded-lg border border-rule px-3 py-2 text-sm"
      >
        <option value="">No vehicle</option>
        {vehicles.map((v) => (
          <option key={v.id} value={v.id}>
            {v.label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={isPending || vehicleId === (currentVehicleId ?? "")}
        className="rounded-lg border border-rule px-3 py-2 text-sm font-medium text-ink hover:bg-leaf-soft disabled:opacity-60"
      >
        {isPending ? "Saving…" : "Update"}
      </button>
    </form>
  );
}