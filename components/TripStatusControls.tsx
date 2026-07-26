"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTripStatus } from "@/lib/actions/transport";
import { emitToast } from "@/lib/toast";
import { TRIP_STATUS_LABELS, type TripDirection, type TripStatusValue } from "@/types/database";

const STATUSES: TripStatusValue[] = ["not_started", "en_route", "arrived"];

export function TripStatusControls({
  routeId,
  tripDate,
  direction,
  currentStatus,
}: {
  routeId: string;
  tripDate: string;
  direction: TripDirection;
  currentStatus: TripStatusValue;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function setStatus(status: TripStatusValue) {
    startTransition(async () => {
      try {
        await updateTripStatus({ routeId, tripDate, direction, status });
        router.refresh();
      } catch (err) {
        emitToast(err instanceof Error ? err.message : "Something went wrong.", "error");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs capitalize text-ink-soft">{direction}:</span>
      {STATUSES.map((s) => (
        <button
          key={s}
          onClick={() => setStatus(s)}
          disabled={isPending || s === currentStatus}
          className={`rounded-full px-2.5 py-1 text-xs font-medium disabled:cursor-default ${
            s === currentStatus
              ? "bg-leaf text-white"
              : "border border-rule text-ink-soft hover:bg-paper"
          }`}
        >
          {TRIP_STATUS_LABELS[s]}
        </button>
      ))}
    </div>
  );
}
