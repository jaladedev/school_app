"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelHostelWaitlistEntry } from "@/lib/actions/hostel";
import { emitToast } from "@/lib/toast";

type WaitlistEntry = {
  id: string;
  fullName: string;
  admissionNo: string | null;
  requestedAt: string;
};

export function HostelWaitlistPanel({
  hostelId,
  entries,
}: {
  hostelId: string;
  entries: WaitlistEntry[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleCancel(entryId: string) {
    startTransition(async () => {
      try {
        await cancelHostelWaitlistEntry(entryId, hostelId);
        emitToast("Removed from the waitlist.");
        router.refresh();
      } catch (err) {
        emitToast(err instanceof Error ? err.message : "Something went wrong.", "error");
      }
    });
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="flex items-center justify-between rounded-lg border border-rule bg-white p-3 text-sm"
        >
          <div>
            <p className="font-medium text-ink">{entry.fullName}</p>
            <p className="text-xs text-ink-soft">
              {entry.admissionNo ? `${entry.admissionNo} · ` : ""}
              Waiting since {new Date(entry.requestedAt).toLocaleDateString()}
            </p>
          </div>
          <button
            onClick={() => handleCancel(entry.id)}
            disabled={isPending}
            className="rounded-lg border border-rule px-2.5 py-1 text-xs text-ink-soft hover:bg-paper disabled:opacity-60"
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}
