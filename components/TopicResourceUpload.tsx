"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadTopicResource } from "@/lib/actions/teacher";
import { emitToast } from "@/lib/toast";

export function TopicResourceUpload({ topicId, noteId }: { topicId: string; noteId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.set("file", file);
    formData.set("title", title);
    setError(null);
    startTransition(async () => {
      try {
        await uploadTopicResource(topicId, noteId, formData);
        setTitle("");
        emitToast("Resource uploaded.");
        router.refresh();
      } catch (err: any) {
        setError(err.message ?? "Could not upload the resource.");
      } finally {
        event.target.value = "";
      }
    });
  }

  return (
    <section className="mt-6 rounded-xl border border-rule bg-white p-4">
      <h2 className="font-display text-lg font-semibold text-ink">Topic resources</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Attach images, PDFs, audio, or video (up to 20 MB).
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Resource title (optional)"
          className="flex-1 rounded-lg border border-rule px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isPending}
          className="rounded-lg border border-leaf px-3 py-2 text-sm font-medium text-leaf hover:bg-leaf-soft disabled:opacity-60"
        >
          {isPending ? "Uploading…" : "Upload file"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf,audio/mpeg,audio/wav,audio/ogg,video/mp4,video/webm"
          onChange={handleFile}
          className="hidden"
        />
      </div>
      {error && <p className="mt-2 text-sm text-clay">{error}</p>}
    </section>
  );
}
