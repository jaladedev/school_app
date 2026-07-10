"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function DeleteEntryButton({ entryId }: { entryId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    await supabase.from("timetable_entries").delete().eq("id", entryId);
    setDeleting(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="text-xs text-clay hover:underline disabled:opacity-60"
    >
      {deleting ? "Removing…" : "Remove"}
    </button>
  );
}
