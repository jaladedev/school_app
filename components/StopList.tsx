"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateStop, moveStop } from "@/lib/actions/transport";
import { emitToast } from "@/lib/toast";

type Stop = { id: string; name: string; sequence_order: number; approx_time: string | null };

export function StopList({ stops }: { stops: Stop[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [approxTime, setApproxTime] = useState("");
  const [isPending, startTransition] = useTransition();

  function startEdit(stop: Stop) {
    setEditingId(stop.id);
    setName(stop.name);
    setApproxTime(stop.approx_time?.slice(0, 5) ?? "");
  }

  function saveEdit(stopId: string) {
    startTransition(async () => {
      try {
        await updateStop({ stopId, name, approxTime: approxTime || undefined });
        emitToast("Stop updated.");
        setEditingId(null);
        router.refresh();
      } catch (err) {
        emitToast(err instanceof Error ? err.message : "Something went wrong.", "error");
      }
    });
  }

  function move(stopId: string, direction: "up" | "down") {
    startTransition(async () => {
      try {
        await moveStop(stopId, direction);
        router.refresh();
      } catch (err) {
        emitToast(err instanceof Error ? err.message : "Something went wrong.", "error");
      }
    });
  }

  const sorted = [...stops].sort((a, b) => a.sequence_order - b.sequence_order);

  return (
    <div className="space-y-1">
      {sorted.map((s, i) =>
        editingId === s.id ? (
          <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-rule bg-paper p-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg border border-rule px-2 py-1 text-sm"
            />
            <input
              type="time"
              value={approxTime}
              onChange={(e) => setApproxTime(e.target.value)}
              className="rounded-lg border border-rule px-2 py-1 text-sm"
            />
            <button
              onClick={() => saveEdit(s.id)}
              disabled={isPending}
              className="rounded-lg bg-leaf px-2 py-1 text-xs font-medium text-white disabled:opacity-60"
            >
              Save
            </button>
            <button
              onClick={() => setEditingId(null)}
              className="rounded-lg border border-rule px-2 py-1 text-xs text-ink-soft"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div key={s.id} className="flex items-center justify-between rounded-lg border border-rule bg-white px-3 py-2">
            <p className="text-sm text-ink">
              {s.sequence_order}. {s.name}
              {s.approx_time && <span className="text-ink-soft"> · {s.approx_time.slice(0, 5)}</span>}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => move(s.id, "up")}
                disabled={isPending || i === 0}
                aria-label="Move up"
                className="rounded border border-rule px-2 py-1 text-xs text-ink-soft hover:bg-paper disabled:opacity-30"
              >
                ↑
              </button>
              <button
                onClick={() => move(s.id, "down")}
                disabled={isPending || i === sorted.length - 1}
                aria-label="Move down"
                className="rounded border border-rule px-2 py-1 text-xs text-ink-soft hover:bg-paper disabled:opacity-30"
              >
                ↓
              </button>
              <button
                onClick={() => startEdit(s)}
                className="rounded border border-rule px-2 py-1 text-xs text-ink hover:bg-leaf-soft"
              >
                Edit
              </button>
            </div>
          </div>
        )
      )}
      {!sorted.length && <p className="text-sm text-ink-soft">No stops added yet.</p>}
    </div>
  );
}