"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reviewHomeworkSubmission } from "@/lib/actions/homeworkSubmissions";
import { emitToast } from "@/lib/toast";

export function HomeworkSubmissionReview({
  submissionId,
  studentName,
  fileName,
  signedUrl,
  status,
  remark,
}: {
  submissionId: string;
  studentName: string;
  fileName: string | null;
  signedUrl: string | null;
  status: "submitted" | "reviewed";
  remark: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(remark ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        await reviewHomeworkSubmission(submissionId, value);
        emitToast("Marked reviewed.");
        router.refresh();
      } catch (err: any) {
        setError(err.message ?? "Could not save review.");
      }
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 border-t border-rule py-2 first:border-t-0 first:pt-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-ink">{studentName}</p>
        {signedUrl ? (
          <a
            href={signedUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-leaf underline underline-offset-2"
          >
            {fileName ?? "View file"}
          </a>
        ) : (
          <span className="text-xs text-ink-soft">No file</span>
        )}
      </div>

      {status === "reviewed" ? (
        <span className="shrink-0 rounded-full bg-leaf-soft px-2.5 py-1 text-xs font-medium text-leaf">
          Reviewed
        </span>
      ) : (
        <div className="flex shrink-0 items-center gap-2">
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Remark (optional)"
            className="w-40 rounded-lg border border-rule px-2 py-1 text-xs"
          />
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded-full bg-leaf-soft px-2.5 py-1 text-xs font-medium text-leaf hover:bg-leaf/20 disabled:opacity-60"
          >
            {isPending ? "..." : "Mark reviewed"}
          </button>
        </div>
      )}
      {error && <p className="text-xs text-clay">{error}</p>}
    </div>
  );
}
