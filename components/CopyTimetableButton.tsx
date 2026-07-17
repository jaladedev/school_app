"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function CopyTimetableButton({
  classId,
  fromTerm,
  toTerm,
}: {
  classId: string;
  fromTerm: number;
  toTerm: number;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleCopy() {
    setMessage(null);

    startTransition(async () => {
      const { data: sourceEntries } = await supabase
        .from("timetable_entries")
        .select("*")
        .eq("class_id", classId)
        .eq("term", fromTerm);

      if (!sourceEntries?.length) {
        setMessage(`Term ${fromTerm} has no periods to copy.`);
        return;
      }

      const { data: existingTarget } = await supabase
        .from("timetable_entries")
        .select("weekday, period_number")
        .eq("class_id", classId)
        .eq("term", toTerm);

      const targetOccupied = new Set(
        (existingTarget ?? []).map((e) => `${e.weekday}-${e.period_number}`)
      );

      // Also check the entries already sitting in the target term across
      // *other* classes, so we don't double-book a teacher who's simply
      // teaching a different class in that same slot this term.
      const teacherIds = [...new Set(sourceEntries.map((e) => e.teacher_id))];
      const { data: teacherBusy } = teacherIds.length
        ? await supabase
            .from("timetable_entries")
            .select("teacher_id, weekday, period_number")
            .eq("term", toTerm)
            .in("teacher_id", teacherIds)
        : { data: [] };

      const teacherOccupied = new Set(
        (teacherBusy ?? []).map((e) => `${e.teacher_id}-${e.weekday}-${e.period_number}`)
      );

      const toInsert = [];
      let skipped = 0;

      for (const entry of sourceEntries) {
        const classSlotKey = `${entry.weekday}-${entry.period_number}`;
        const teacherSlotKey = `${entry.teacher_id}-${entry.weekday}-${entry.period_number}`;

        if (targetOccupied.has(classSlotKey) || teacherOccupied.has(teacherSlotKey)) {
          skipped += 1;
          continue;
        }

        toInsert.push({
          class_id: entry.class_id,
          subject_id: entry.subject_id,
          teacher_id: entry.teacher_id,
          weekday: entry.weekday,
          period_number: entry.period_number,
          start_time: entry.start_time,
          end_time: entry.end_time,
          room: entry.room,
          academic_year: entry.academic_year,
          term: toTerm,
        });

        // Reserve the slots we're about to fill so two source entries
        // that would otherwise collide with each other don't both go in.
        targetOccupied.add(classSlotKey);
        teacherOccupied.add(teacherSlotKey);
      }

      if (toInsert.length) {
        const { error } = await supabase.from("timetable_entries").insert(toInsert);
        if (error) {
          setMessage(`Copy failed: ${error.message}`);
          return;
        }
      }

      setMessage(
        `Copied ${toInsert.length} period${toInsert.length === 1 ? "" : "s"} from Term ${fromTerm}` +
          (skipped ? `. Skipped ${skipped} that would conflict in Term ${toTerm}.` : ".")
      );
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleCopy}
        disabled={isPending}
        className="rounded-lg border border-rule px-3 py-2 text-sm font-medium text-ink hover:bg-paper disabled:opacity-60"
      >
        {isPending ? "Copying…" : `Copy Term ${fromTerm} → Term ${toTerm}`}
      </button>
      {message && <p className="text-xs text-ink-soft">{message}</p>}
    </div>
  );
}
