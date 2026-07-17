"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deactivateUser } from "@/lib/actions/admin";

export function DeactivateUserButton({ userId, isActive }: { userId: string; isActive: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleToggle() {
    setError(null);
    startTransition(async () => {
      try {
        await deactivateUser(userId, isActive);
        setConfirming(false);
        router.refresh();
      } catch (err: any) {
        setError(err.message ?? "Something went wrong.");
      }
    });
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-ink-soft">
          {isActive ? "Deactivate this account?" : "Reactivate this account?"}
        </span>
        <button
          onClick={handleToggle}
          disabled={isPending}
          className="font-medium text-clay hover:underline disabled:opacity-60"
        >
          {isPending ? "Working…" : "Confirm"}
        </button>
        <button onClick={() => setConfirming(false)} className="text-ink-soft hover:underline">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => setConfirming(true)}
        className={`text-xs font-medium hover:underline ${
          isActive ? "text-ink-soft hover:text-clay" : "text-leaf"
        }`}
      >
        {isActive ? "Deactivate" : "Reactivate"}
      </button>
      {error && <p className="mt-1 text-xs text-clay">{error}</p>}
    </div>
  );
}
