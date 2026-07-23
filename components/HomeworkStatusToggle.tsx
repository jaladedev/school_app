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
  const nextStatus: HomeworkStatus =
    status === "given" ? "reviewed" : status === "reviewed" ? "graded" : "given";
  const label =
    status === "given" ? "Mark reviewed" : status === "reviewed" ? "Mark graded" : "Reopen";

  function handleToggle() {
    startTransition(async () => {
      await updateHomeworkStatus(lessonId, nextStatus);
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className={`rounded-full px-2.5 py-1 text-xs font-medium transition disabled:opacity-60 ${
        status === "graded"
          ? "bg-sky-100 text-sky-800 hover:bg-sky-200"
          : status === "reviewed"
            ? "bg-leaf-soft text-leaf hover:bg-leaf/20"
            : "bg-marigold/20 text-marigold-dark hover:bg-marigold/30"
      }`}
    >
      {isPending ? "..." : label}
    </button>
  );
}
