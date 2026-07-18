"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function DeleteEntryButton({ entryId }: { entryId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Auto-cancel the confirm state after a few seconds so a stray click
  // days later on a since-forgotten "Confirm?" doesn't delete something
  // unexpectedly.
  useEffect(() => {
    if (!confirming) return;
    const timeout = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(timeout);
  }, [confirming]);

  async function handleConfirmedDelete() {
    setDeleting(true);
    await supabase.from("timetable_entries").delete().eq("id", entryId);
    setDeleting(false);
    setConfirming(false);
    router.refresh();
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2 text-xs">
        <button
          onClick={handleConfirmedDelete}
          disabled={deleting}
          className="font-medium text-clay hover:underline disabled:opacity-60"
        >
          {deleting ? "Removing…" : "Confirm remove?"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={deleting}
          className="text-ink-soft hover:underline"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button onClick={() => setConfirming(true)} className="text-xs text-clay hover:underline">
      Remove
    </button>
  );
}