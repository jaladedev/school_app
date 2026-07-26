"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { unassignStudentFromRoute } from "@/lib/actions/transport";
import { emitToast } from "@/lib/toast";

type Occupant = {
  id: string;
  fullName: string;
  admissionNo: string | null;
  stopName: string;
};

export function RouteOccupants({ occupants }: { occupants: Occupant[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function unassign(assignmentId: string) {
    startTransition(async () => {
      try {
        await unassignStudentFromRoute(assignmentId);
        emitToast("Student unassigned.");
        router.refresh();
      } catch (err) {
        emitToast(err instanceof Error ? err.message : "Something went wrong.", "error");
      }
    });
  }

  return (
    <div className="space-y-2">
      {occupants.map((o) => (
        <div
          key={o.id}
          className="flex items-center justify-between rounded-lg border border-rule bg-white p-3"
        >
          <div>
            <p className="text-sm font-medium text-ink">{o.fullName}</p>
            <p className="text-xs text-ink-soft">
              {o.admissionNo ? `${o.admissionNo} · ` : ""}
              {o.stopName}
            </p>
          </div>
          <button
            onClick={() => unassign(o.id)}
            disabled={isPending}
            className="rounded-lg border border-rule px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-paper disabled:opacity-60"
          >
            Unassign
          </button>
        </div>
      ))}
    </div>
  );
}
