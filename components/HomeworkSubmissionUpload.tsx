"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitHomework } from "@/lib/actions/homeworkSubmissions";
import { emitToast } from "@/lib/toast";
import type { HomeworkSubmissionStatus } from "@/types/database";

export function HomeworkSubmissionUpload({
  lessonId,
  existing,
}: {
  lessonId: string;
  existing: {
    fileName: string | null;
    status: HomeworkSubmissionStatus;
    remark: string | null;
  } | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.set("file", file);
    setError(null);
    startTransition(async () => {
      try {
        await submitHomework(lessonId, formData);
        emitToast(existing ? "Homework resubmitted." : "Homework submitted.");
        router.refresh();
      } catch (err: any) {
        setError(err.message ?? "Could not submit homework.");
      } finally {
        event.target.value = "";
      }
    });
  }

  const reviewed = existing?.status === "reviewed";

  return (
    <div className="mt-2 rounded-lg border border-dashed border-rule bg-paper p-3">
      {existing ? (
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-ink">Submitted: {existing.fileName}</p>
            <span
              className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                reviewed ? "bg-leaf-soft text-leaf" : "bg-marigold/20 text-marigold-text"
              }`}
            >
              {reviewed ? "Reviewed" : "Awaiting review"}
            </span>
          </div>
        </div>
      ) : (
        <p className="mb-2 text-xs text-ink-soft">No submission yet.</p>
      )}

      {existing?.remark && (
        <p className="mb-2 rounded-md bg-white p-2 text-xs text-ink">
          <span className="font-medium">Teacher note: </span>
          {existing.remark}
        </p>
      )}

      {!reviewed && (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isPending}
            className="rounded-lg border border-leaf px-3 py-1.5 text-xs font-medium text-leaf hover:bg-leaf-soft disabled:opacity-60"
          >
            {isPending ? "Uploading…" : existing ? "Resubmit file" : "Upload homework"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={handleFile}
            className="hidden"
          />
        </>
      )}
      {error && <p className="mt-2 text-xs text-clay">{error}</p>}
    </div>
  );
}
