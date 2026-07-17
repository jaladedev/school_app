"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AssignClassTeacherSelect({
  classId,
  currentTeacherId,
  teachers,
}: {
  classId: string;
  currentTeacherId: string | null;
  teachers: { id: string; full_name: string }[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [teacherId, setTeacherId] = useState(currentTeacherId ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleChange(value: string) {
    setTeacherId(value);
    setError(null);

    startTransition(async () => {
      const { error: updateError } = await supabase
        .from("classes")
        .update({ class_teacher_id: value || null })
        .eq("id", classId);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      router.refresh();
    });
  }

  return (
    <div>
      <select
        value={teacherId}
        onChange={(e) => handleChange(e.target.value)}
        disabled={isPending}
        className="rounded-lg border border-rule bg-paper px-2 py-1 text-xs text-ink-soft disabled:opacity-60"
      >
        <option value="">No class teacher</option>
        {teachers.map((t) => (
          <option key={t.id} value={t.id}>
            {t.full_name}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-clay">{error}</p>}
    </div>
  );
}
