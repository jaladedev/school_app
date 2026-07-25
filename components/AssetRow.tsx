"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ASSET_CONDITIONS, type Asset, type AssetCondition } from "@/types/database";
import { emitToast } from "@/lib/toast";

const CONDITION_STYLES: Record<AssetCondition, string> = {
  new: "bg-leaf-soft text-leaf",
  good: "bg-leaf-soft text-leaf",
  fair: "bg-marigold-soft text-ink",
  poor: "bg-marigold-soft text-ink",
  damaged: "bg-clay/10 text-clay",
};

export function AssetRow({ asset }: { asset: Asset }) {
  const router = useRouter();
  const supabase = createClient();

  const [editing, setEditing] = useState(false);
  const [condition, setCondition] = useState<AssetCondition>(asset.condition);
  const [location, setLocation] = useState(asset.location ?? "");
  const [assignedTo, setAssignedTo] = useState(asset.assigned_to ?? "");
  const [isPending, startTransition] = useTransition();
  const [confirmArchive, setConfirmArchive] = useState(false);

  function saveEdits() {
    startTransition(async () => {
      const { error } = await supabase
        .from("assets")
        .update({
          condition,
          location: location.trim() || null,
          assigned_to: assignedTo.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", asset.id);

      if (error) {
        emitToast(error.message, "error");
        return;
      }

      emitToast("Asset updated.");
      setEditing(false);
      router.refresh();
    });
  }

  function toggleArchive() {
    startTransition(async () => {
      const { error } = await supabase
        .from("assets")
        .update({ is_archived: !asset.is_archived, updated_at: new Date().toISOString() })
        .eq("id", asset.id);

      if (error) {
        emitToast(error.message, "error");
        return;
      }

      emitToast(asset.is_archived ? "Asset restored." : "Asset archived.");
      setConfirmArchive(false);
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-rule bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-ink">{asset.name}</p>
          <p className="text-xs text-ink-soft">
            {asset.category ?? "Uncategorized"}
            {asset.serial_no ? ` · ${asset.serial_no}` : ""}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${CONDITION_STYLES[asset.condition]}`}
        >
          {asset.condition[0].toUpperCase() + asset.condition.slice(1)}
        </span>
      </div>

      {!editing ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-soft">
            {asset.location ?? "No location set"}
            {asset.assigned_to ? ` · Assigned to ${asset.assigned_to}` : ""}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(true)}
              className="rounded-lg border border-rule px-3 py-1.5 text-sm font-medium text-ink hover:bg-leaf-soft"
            >
              Edit
            </button>
            {confirmArchive ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={toggleArchive}
                  disabled={isPending}
                  className="rounded-lg bg-clay px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmArchive(false)}
                  className="rounded-lg border border-rule px-3 py-1.5 text-sm text-ink-soft"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => (asset.is_archived ? toggleArchive() : setConfirmArchive(true))}
                className="rounded-lg border border-rule px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-paper"
              >
                {asset.is_archived ? "Restore" : "Archive"}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-2 border-t border-rule pt-3">
          <div className="grid grid-cols-2 gap-2">
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value as AssetCondition)}
              className="rounded-lg border border-rule px-3 py-2 text-sm"
            >
              {ASSET_CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {c[0].toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
            <input
              placeholder="Location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
            />
            <input
              placeholder="Assigned to"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="col-span-2 rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={saveEdits}
              disabled={isPending}
              className="rounded-lg bg-leaf px-3 py-1.5 text-sm font-medium text-white hover:bg-leaf/90 disabled:opacity-60"
            >
              {isPending ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => {
                setCondition(asset.condition);
                setLocation(asset.location ?? "");
                setAssignedTo(asset.assigned_to ?? "");
                setEditing(false);
              }}
              className="rounded-lg border border-rule px-3 py-1.5 text-sm text-ink-soft"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
