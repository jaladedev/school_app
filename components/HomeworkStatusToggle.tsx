"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateHomeworkStatus } from "@/lib/actions/teacher";
import type { HomeworkStatus } from "@/types/database";

export function HomeworkStatusToggle({
  lessonId,
  status,
}: {
  lessonId: string;
  status: HomeworkStatus;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      await updateHomeworkStatus(lessonId, status === "given" ? "reviewed" : "given");
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className={`rounded-full px-2.5 py-1 text-xs font-medium transition disabled:opacity-60 ${
        status === "reviewed"
          ? "bg-leaf-soft text-leaf hover:bg-leaf/20"
          : "bg-marigold/20 text-marigold-dark hover:bg-marigold/30"
      }`}
    >
      {isPending ? "…" : status === "reviewed" ? "Reviewed" : "Mark reviewed"}
    </button>
  );
}
