"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { linkVehicleDriver } from "@/lib/actions/transport";
import { emitToast } from "@/lib/toast";

export function LinkDriverForm({
  vehicleId,
  currentDriverProfileId,
  drivers,
}: {
  vehicleId: string;
  currentDriverProfileId: string | null;
  drivers: { id: string; fullName: string }[];
}) {
  const router = useRouter();
  const [value, setValue] = useState(currentDriverProfileId ?? "");
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    setValue(next);
    startTransition(async () => {
      try {
        await linkVehicleDriver(vehicleId, next || null);
        emitToast(next ? "Driver account linked." : "Driver account unlinked.");
        router.refresh();
      } catch (err) {
        emitToast(err instanceof Error ? err.message : "Something went wrong.", "error");
      }
    });
  }

  return (
    <select
      value={value}
      onChange={handleChange}
      disabled={isPending}
      className="rounded-lg border border-rule bg-white px-2 py-1 text-xs disabled:opacity-60"
    >
      <option value="">No linked driver account</option>
      {drivers.map((d) => (
        <option key={d.id} value={d.id}>
          {d.fullName}
        </option>
      ))}
    </select>
  );
}
