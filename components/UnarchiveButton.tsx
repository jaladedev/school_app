"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function UnarchiveButton({ classId }: { classId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();

  function handleUnarchive() {
    startTransition(async () => {
      await supabase.from("classes").update({ is_archived: false }).eq("id", classId);
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleUnarchive}
      disabled={isPending}
      className="rounded-lg border border-leaf px-3 py-1.5 text-sm font-medium text-leaf hover:bg-leaf-soft disabled:opacity-60"
    >
      {isPending ? "Restoring…" : "Unarchive"}
    </button>
  );
}
