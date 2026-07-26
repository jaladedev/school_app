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
      try {
        await setQuizPublished(quizId, !isPublished);
        emitToast(isPublished ? "Quiz unpublished." : "Quiz published — students can now take it.");
        router.refresh();
      } catch (err) {
        emitToast(err instanceof Error ? err.message : "Something went wrong.", "error");
      }
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
