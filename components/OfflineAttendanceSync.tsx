"use client";

import { useEffect, useState } from "react";
import { markAttendance } from "@/lib/actions/teacher";
import { emitToast } from "@/lib/toast";
import {
  getQueuedAttendance,
  removeQueuedAttendance,
  type QueuedAttendance,
} from "@/lib/offlineAttendanceQueue";

/**
 * Mounted once in the root layout so a queued attendance write syncs
 * automatically no matter where in the app the teacher is when
 * connectivity returns — not just if they're still sitting on the
 * lesson page they queued it from.
 */
export function OfflineAttendanceSync() {
  const [pending, setPending] = useState<QueuedAttendance[]>([]);
  const [syncing, setSyncing] = useState(false);

  async function refreshPending() {
    try {
      setPending(await getQueuedAttendance());
    } catch {
      // IndexedDB unavailable (e.g. private browsing in some browsers) —
      // fail quiet, there's nothing queued to show either way.
    }
  }

  async function flush() {
    if (syncing) return;
    setSyncing(true);
    try {
      const queued = await getQueuedAttendance();
      for (const item of queued) {
        try {
          await markAttendance(item.lessonId, item.records);
          await removeQueuedAttendance(item.id);
        } catch {
          // Leave it queued — next online event or manual retry will
          // pick it up again. A genuine server-side rejection (e.g. the
          // lesson was deleted) would fail every retry, but there's no
          // safe way to distinguish that from "still offline" here
          // without more state than's worth adding for this case.
          break;
        }
      }
      await refreshPending();
      if (queued.length && (await getQueuedAttendance()).length === 0) {
        emitToast("Offline attendance synced.");
      }
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    refreshPending();
    if (navigator.onLine) flush();

    window.addEventListener("online", flush);
    // Also catch the case where connectivity returns without a reliable
    // 'online' event firing (happens on some mobile browsers) — a light
    // poll while something is actually queued costs nothing.
    const interval = setInterval(() => {
      if (navigator.onLine) refreshPending().then(() => flush());
    }, 30000);

    return () => {
      window.removeEventListener("online", flush);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!pending.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 rounded-lg border border-rule bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-ink">
        {syncing
          ? "Syncing…"
          : `${pending.length} attendance record${pending.length === 1 ? "" : "s"} saved offline`}
      </p>
      {!syncing && (
        <p className="text-ink-soft">Will sync automatically once you're back online.</p>
      )}
    </div>
  );
}
