"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markStudentPickup } from "@/lib/actions/transport";
import { emitToast } from "@/lib/toast";
import type { TripDirection } from "@/types/database";

type RiderStatus = {
  studentId: string;
  fullName: string;
  stopName: string | null;
  pickedUpAt: string | null;
  droppedOffAt: string | null;
};

export function StudentPickupChecklist({
  routeId,
  tripDate,
  direction,
  riders,
}: {
  routeId: string;
  tripDate: string;
  direction: TripDirection;
  riders: RiderStatus[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Morning trip: mark who's been picked up. Afternoon trip: mark who's
  // been dropped off. A student would only ever need one or the other
  // action tracked per direction — this keeps the checklist to a single
  // action per row instead of showing two irrelevant buttons.
  const event = direction === "morning" ? "picked_up" : "dropped_off";
  const label = direction === "morning" ? "Picked up" : "Dropped off";

  function mark(studentId: string) {
    startTransition(async () => {
      try {
        await markStudentPickup({ studentId, routeId, tripDate, direction, event });
        router.refresh();
      } catch (err) {
        emitToast(err instanceof Error ? err.message : "Something went wrong.", "error");
      }
    });
  }

  if (!riders.length) {
    return <p className="text-sm text-ink-soft">No students assigned to this route yet.</p>;
  }

  return (
    <div className="space-y-1.5">
      {riders.map((r) => {
        const done = direction === "morning" ? r.pickedUpAt : r.droppedOffAt;
        return (
          <div
            key={r.studentId}
            className="flex items-center justify-between rounded-lg border border-rule bg-white px-3 py-2"
          >
            <div>
              <p className="text-sm text-ink">{r.fullName}</p>
              {r.stopName && <p className="text-xs text-ink-soft">{r.stopName}</p>}
            </div>
            <button
              onClick={() => mark(r.studentId)}
              disabled={isPending || !!done}
              className={`rounded-full px-3 py-1 text-xs font-medium disabled:cursor-default ${
                done ? "bg-leaf text-white" : "border border-rule text-ink-soft hover:bg-leaf-soft"
              }`}
            >
              {done ? `${label} ✓` : `Mark ${label.toLowerCase()}`}
            </button>
          </div>
        );
      })}
    </div>
  );
}
