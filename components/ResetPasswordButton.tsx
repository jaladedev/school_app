"use client";

import { useState, useTransition } from "react";
import { resetUserPassword } from "@/lib/actions/admin";

export function ResetPasswordButton({ userId }: { userId: string }) {
  const [isPending, startTransition] = useTransition();
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function handleReset() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await resetUserPassword(userId);
        setNewPassword(result.password);
        setConfirming(false);
      } catch (err: any) {
        setError(err.message ?? "Something went wrong.");
      }
    });
  }

  if (newPassword) {
    return (
      <div className="rounded-lg border border-leaf bg-leaf-soft px-3 py-2 text-xs">
        <p className="font-medium text-leaf">
          New password: <span className="font-mono">{newPassword}</span>
        </p>
        <p className="text-ink-soft">
          Share this directly — it won't be shown again. They'll be asked to set their own on
          next login.
        </p>
      </div>
    );
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-ink-soft">Reset their password?</span>
        <button
          onClick={handleReset}
          disabled={isPending}
          className="font-medium text-clay hover:underline disabled:opacity-60"
        >
          {isPending ? "Resetting…" : "Confirm"}
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
        className="text-xs font-medium text-ink-soft hover:text-clay hover:underline"
      >
        Reset password
      </button>
      {error && <p className="mt-1 text-xs text-clay">{error}</p>}
    </div>
  );
}