"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteConversation } from "@/lib/actions/messages";

export function DeleteConversationButton({ partnerId }: { partnerId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      try {
        await deleteConversation(partnerId);
        router.push("/dashboard/messages");
        router.refresh();
      } catch (err: any) {
        setError(err.message ?? "Something went wrong.");
      }
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-sm text-clay hover:underline">
        Delete conversation
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-clay/40 bg-clay/5 p-3">
      <p className="mb-2 text-sm text-ink">
        This permanently deletes every message in this conversation —{" "}
        <strong>for both of you</strong>, not just your side. This can&apos;t be undone.
      </p>
      <p className="mb-2 text-xs text-ink-soft">
        Type <span className="font-mono font-medium">DELETE</span> to confirm.
      </p>
      <div className="flex items-center gap-2">
        <input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          className="w-32 rounded-lg border border-rule px-2 py-1 text-sm outline-none focus-visible:border-clay"
          placeholder="DELETE"
        />
        <button
          onClick={handleDelete}
          disabled={confirmText !== "DELETE" || isPending}
          className="rounded-lg bg-clay px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
        >
          {isPending ? "Deleting…" : "Delete permanently"}
        </button>
        <button
          onClick={() => {
            setOpen(false);
            setConfirmText("");
            setError(null);
          }}
          className="text-sm text-ink-soft hover:underline"
        >
          Cancel
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-clay">{error}</p>}
    </div>
  );
}
