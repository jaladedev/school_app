"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { archiveConversation, unarchiveConversation } from "@/lib/actions/messages";

export function ArchiveConversationButton({
  partnerId,
  isArchived,
}: {
  partnerId: string;
  isArchived: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      if (isArchived) {
        await unarchiveConversation(partnerId);
      } else {
        await archiveConversation(partnerId);
      }
      router.refresh();
    });
  }

  return (
    <button
      onClick={toggle}
      disabled={isPending}
      className="text-sm text-ink-soft hover:underline disabled:opacity-60"
    >
      {isPending ? "…" : isArchived ? "Unarchive" : "Archive"}
    </button>
  );
}
