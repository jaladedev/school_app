"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createHostel } from "@/lib/actions/hostel";
import { emitToast } from "@/lib/toast";

export function CreateHostelForm({
  houseParents,
}: {
  houseParents: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [houseParentId, setHouseParentId] = useState("");
  const [capacity, setCapacity] = useState("");
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
      try {
        await createHostel({
          name,
          gender,
          houseParentId: houseParentId || undefined,
          capacity: capacity ? Number(capacity) : undefined,
        });
        emitToast("Hostel added.");
        setName("");
        setHouseParentId("");
        setCapacity("");
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-marigold px-4 py-2 text-sm font-medium text-ink hover:bg-marigold-dark"
      >
        + New hostel
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-rule bg-white p-4">
      <div className="grid grid-cols-2 gap-3">
        <input
          required
          placeholder="Name (e.g. Unity House)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
        />
        <select
          value={gender}
          onChange={(e) => setGender(e.target.value as "male" | "female")}
          className="rounded-lg border border-rule px-3 py-2 text-sm"
        >
          <option value="male">Boys</option>
          <option value="female">Girls</option>
        </select>
        <select
          value={houseParentId}
          onChange={(e) => setHouseParentId(e.target.value)}
          className="rounded-lg border border-rule px-3 py-2 text-sm"
        >
          <option value="">No house parent yet</option>
          {houseParents.map((hp) => (
            <option key={hp.id} value={hp.id}>
              {hp.name}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          placeholder="Capacity (optional)"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          className="rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
        />
      </div>

      <p className="text-xs text-ink-soft">
        Only teachers with the "House parent" staff role appear above — assign that role from Staff
        management first if the person you need isn't listed.
      </p>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-leaf px-3 py-2 text-sm font-medium text-white hover:bg-leaf/90 disabled:opacity-60"
        >
          {isPending ? "Adding…" : "Add hostel"}
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
