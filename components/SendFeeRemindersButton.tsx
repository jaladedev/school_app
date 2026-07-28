"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendFeeReminders } from "@/lib/actions/fees";

export function SendFeeRemindersButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSend() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await sendFeeReminders();
        setMessage(
          result.remindersSent > 0
            ? `Sent ${result.remindersSent} reminder(s) (of ${result.invoicesConsidered} outstanding invoice(s) checked).`
            : result.invoicesConsidered > 0
              ? "Everyone outstanding was already reminded recently — nothing sent."
              : "No outstanding invoices to remind."
        );
        router.refresh();
      } catch (err: any) {
        setError(err.message ?? "Could not send reminders.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleSend}
        disabled={isPending}
        className="rounded-lg border border-rule px-4 py-2 text-sm font-medium text-ink hover:bg-paper disabled:opacity-60"
      >
        {isPending ? "Sending…" : "Send fee reminders"}
      </button>
      {message && <p className="text-xs text-leaf">{message}</p>}
      {error && <p className="text-xs text-clay">{error}</p>}
    </div>
  );
}
