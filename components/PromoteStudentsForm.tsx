"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { promoteStudents, type PromotionOutcome } from "@/lib/actions/admin";

type ClassOption = { id: string; name: string; arm: string | null };
type StudentOption = { id: string; full_name: string };

export function PromoteStudentsForm({
  classes,
  studentsBySourceClass,
}: {
  classes: ClassOption[];
  studentsBySourceClass: Record<string, StudentOption[]>;
}) {
  const router = useRouter();
  const [sourceClassId, setSourceClassId] = useState(classes[0]?.id ?? "");
  const [outcome, setOutcome] = useState<PromotionOutcome>("promote");
  const [targetClassId, setTargetClassId] = useState(classes[1]?.id ?? classes[0]?.id ?? "");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ succeeded: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const students = studentsBySourceClass[sourceClassId] ?? [];

  function toggleStudent(id: string) {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  function selectAll() {
    setSelectedStudentIds(students.map((s) => s.id));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!selectedStudentIds.length) {
      setError("Select at least one student.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await promoteStudents({
          studentIds: selectedStudentIds,
          targetClassId: outcome === "graduate" ? null : targetClassId,
          outcome,
        });
        setResult({ succeeded: res.succeeded, failed: res.failed });
        setSelectedStudentIds([]);
        router.refresh();
      } catch (err: any) {
        setError(err.message ?? "Something went wrong.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-soft">
          Source class
        </label>
        <select
          value={sourceClassId}
          onChange={(e) => {
            setSourceClassId(e.target.value);
            setSelectedStudentIds([]);
          }}
          className="w-full rounded-lg border border-rule px-3 py-2 text-sm"
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} {c.arm}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            Students ({selectedStudentIds.length} selected)
          </label>
          <button
            type="button"
            onClick={selectAll}
            className="text-xs font-medium text-leaf hover:underline"
          >
            Select all
          </button>
        </div>
        <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-rule bg-white p-2">
          {students.map((s) => (
            <label
              key={s.id}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-paper"
            >
              <input
                type="checkbox"
                checked={selectedStudentIds.includes(s.id)}
                onChange={() => toggleStudent(s.id)}
              />
              {s.full_name}
            </label>
          ))}
          {!students.length && (
            <p className="px-2 py-1.5 text-sm text-ink-soft">No students in this class.</p>
          )}
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-soft">Outcome</p>
        <div className="flex gap-2">
          {(["promote", "repeat", "graduate"] as PromotionOutcome[]).map((o) => (
            <button
              type="button"
              key={o}
              onClick={() => {
                setOutcome(o);
                if (o === "repeat") setTargetClassId(sourceClassId);
              }}
              className={`rounded-lg border px-3 py-2 text-sm font-medium capitalize transition ${
                outcome === o ? "border-leaf bg-leaf-soft text-leaf" : "border-rule text-ink-soft"
              }`}
            >
              {o}
            </button>
          ))}
        </div>
      </div>

      {outcome !== "graduate" && (
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-soft">
            Target class
          </label>
          <select
            value={targetClassId}
            onChange={(e) => setTargetClassId(e.target.value)}
            className="w-full rounded-lg border border-rule px-3 py-2 text-sm"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.arm}
              </option>
            ))}
          </select>
        </div>
      )}

      {outcome === "graduate" && (
        <p className="rounded-lg bg-marigold/10 p-3 text-sm text-marigold-dark">
          Graduating removes these students from any class. There&apos;s currently no separate
          &quot;alumni&quot; status — this just clears their class assignment.
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-leaf px-4 py-2 text-sm font-medium text-white hover:bg-leaf/90 disabled:opacity-60"
      >
        {isPending
          ? "Processing…"
          : `${outcome === "graduate" ? "Graduate" : outcome === "repeat" ? "Repeat" : "Promote"} selected students`}
      </button>

      {result && (
        <p className="text-sm text-leaf">
          Done: {result.succeeded} updated{result.failed ? `, ${result.failed} failed` : ""}.
        </p>
      )}
      {error && <p className="text-sm text-clay">{error}</p>}
    </form>
  );
}