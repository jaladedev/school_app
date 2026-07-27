"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createDriverAccount, linkDriverToVehicle } from "@/lib/actions/driverAccounts";
import { emitToast } from "@/lib/toast";

export function DriverAccountSection({
  vehicleId,
  currentDriverName,
  existingDrivers,
}: {
  vehicleId: string;
  currentDriverName: string | null;
  existingDrivers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "create" | "link">("idle");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState(existingDrivers[0]?.id ?? "");
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!fullName.trim() || !email.trim()) return setError("Name and email are required.");

    startTransition(async () => {
      try {
        const result = await createDriverAccount({
          fullName,
          email,
          phone: phone || undefined,
          vehicleId,
        });
        setTempPassword(result.tempPassword);
        emitToast("Driver account created.");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  function handleLink() {
    startTransition(async () => {
      try {
        await linkDriverToVehicle(vehicleId, selectedDriverId);
        emitToast("Driver linked.");
        setMode("idle");
        router.refresh();
      } catch (err) {
        emitToast(err instanceof Error ? err.message : "Something went wrong.", "error");
      }
    });
  }

  function handleUnlink() {
    startTransition(async () => {
      try {
        await linkDriverToVehicle(vehicleId, null);
        emitToast("Driver unlinked.");
        router.refresh();
      } catch (err) {
        emitToast(err instanceof Error ? err.message : "Something went wrong.", "error");
      }
    });
  }

  if (tempPassword) {
    return (
      <div className="bg-marigold-soft rounded-lg border border-marigold p-3 text-xs">
        <p className="mb-1 font-medium text-ink">
          Driver account created — share these sign-in details now, they won't be shown again:
        </p>
        <p className="font-mono text-ink">
          {email} / {tempPassword}
        </p>
        <p className="mt-1 text-ink-soft">
          They'll be asked to set their own password on first login.
        </p>
        <button
          onClick={() => setTempPassword(null)}
          className="mt-2 rounded border border-rule px-2 py-1 text-ink-soft hover:bg-white"
        >
          Done
        </button>
      </div>
    );
  }

  if (currentDriverName) {
    return (
      <div className="flex items-center justify-between text-xs">
        <span className="text-ink-soft">Driver: {currentDriverName}</span>
        <button onClick={handleUnlink} disabled={isPending} className="text-clay hover:underline">
          Unlink
        </button>
      </div>
    );
  }

  if (mode === "idle") {
    return (
      <div className="flex gap-2 text-xs">
        <button onClick={() => setMode("create")} className="text-leaf hover:underline">
          + Create driver account
        </button>
        {existingDrivers.length > 0 && (
          <button onClick={() => setMode("link")} className="text-leaf hover:underline">
            Link existing driver
          </button>
        )}
      </div>
    );
  }

  if (mode === "link") {
    return (
      <div className="flex items-center gap-2">
        <select
          value={selectedDriverId}
          onChange={(e) => setSelectedDriverId(e.target.value)}
          className="rounded-lg border border-rule px-2 py-1 text-xs"
        >
          {existingDrivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <button
          onClick={handleLink}
          disabled={isPending}
          className="rounded-lg bg-leaf px-2 py-1 text-xs font-medium text-white disabled:opacity-60"
        >
          Link
        </button>
        <button onClick={() => setMode("idle")} className="text-xs text-ink-soft">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleCreate} className="space-y-2 rounded-lg border border-rule bg-paper p-2">
      <div className="flex flex-wrap gap-2">
        <input
          required
          placeholder="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="rounded-lg border border-rule px-2 py-1 text-xs"
        />
        <input
          required
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-rule px-2 py-1 text-xs"
        />
        <input
          placeholder="Phone (optional)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="rounded-lg border border-rule px-2 py-1 text-xs"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-leaf px-2 py-1 text-xs font-medium text-white disabled:opacity-60"
        >
          {isPending ? "Creating…" : "Create"}
        </button>
        <button
          type="button"
          onClick={() => setMode("idle")}
          className="rounded-lg border border-rule px-2 py-1 text-xs text-ink-soft"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-clay">{error}</p>}
    </form>
  );
}
