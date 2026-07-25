"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ASSET_CONDITIONS, type AssetCondition } from "@/types/database";
import { emitToast } from "@/lib/toast";

export function CreateAssetForm() {
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [serialNo, setSerialNo] = useState("");
  const [condition, setCondition] = useState<AssetCondition>("good");
  const [location, setLocation] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Name is required.");
      return;
    }

    startTransition(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error: insertError } = await supabase.from("assets").insert({
        name: name.trim(),
        category: category.trim() || null,
        serial_no: serialNo.trim() || null,
        condition,
        location: location.trim() || null,
        assigned_to: assignedTo.trim() || null,
        notes: notes.trim() || null,
        created_by: user?.id ?? null,
      });

      if (insertError) {
        setError(insertError.message);
        return;
      }

      emitToast("Asset added.");
      setName("");
      setCategory("");
      setSerialNo("");
      setCondition("good");
      setLocation("");
      setAssignedTo("");
      setNotes("");
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-marigold px-4 py-2 text-sm font-medium text-ink hover:bg-marigold-dark"
      >
        + New asset
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 space-y-3 rounded-xl border border-rule bg-white p-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <input
          required
          placeholder="Name (e.g. Dell laptop)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
        />
        <input
          placeholder="Category (optional, e.g. ICT equipment)"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
        />
        <input
          placeholder="Serial no. (optional)"
          value={serialNo}
          onChange={(e) => setSerialNo(e.target.value)}
          className="rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
        />
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
          placeholder="Location (optional, e.g. Staff room)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
        />
        <input
          placeholder="Assigned to (optional, e.g. Mrs. Adebayo)"
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
          className="rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
        />
      </div>

      <textarea
        placeholder="Notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        className="w-full rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
      />

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-leaf px-3 py-2 text-sm font-medium text-white hover:bg-leaf/90 disabled:opacity-60"
        >
          {isPending ? "Adding…" : "Add asset"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-rule px-3 py-2 text-sm text-ink-soft"
        >
          Cancel
        </button>
      </div>

      {error && <p className="text-sm text-clay">{error}</p>}
    </form>
  );
}
