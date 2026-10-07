"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setQuizPublished } from "@/lib/actions/quiz";
import { emitToast } from "@/lib/toast";

export function PublishToggle({ quizId, isPublished }: { quizId: string; isPublished: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const result = await setQuizPublished(quizId, !isPublished);
      if (!result.ok) {
        emitToast(result.error, "error");
        return;
      }
      emitToast(isPublished ? "Quiz unpublished." : "Quiz published — students can now take it.");
      router.refresh();
    });
  }

  return (
    <button
      onClick={toggle}
      disabled={isPending}
      className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60 ${
        isPublished
          ? "border border-rule text-ink-soft hover:bg-paper"
          : "bg-leaf text-white hover:bg-leaf/90"
      }`}
    >
      {isPending ? "…" : isPublished ? "Unpublish" : "Publish"}
    </button>
  );
}
