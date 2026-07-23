"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { uploadStudentPhoto } from "@/lib/actions/admin";
import { emitToast } from "@/lib/toast";

export function StudentPhotoUpload({
  studentId,
  fullName,
  photoUrl,
}: {
  studentId: string;
  fullName: string;
  photoUrl: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const photo = event.target.files?.[0];
    if (!photo) return;

    setError(null);
    const formData = new FormData();
    formData.set("photo", photo);

    startTransition(async () => {
      try {
        await uploadStudentPhoto(studentId, formData);
        emitToast("Student photo updated.");
        router.refresh();
      } catch (err: any) {
        setError(err.message ?? "Could not upload the photo.");
      } finally {
        event.target.value = "";
      }
    });
  }

  return (
    <div className="flex items-center gap-4 rounded-xl border border-rule bg-white p-4">
      {photoUrl ? (
        <Image
          src={photoUrl}
          alt={`${fullName}'s profile photo`}
          width={80}
          height={80}
          className="h-20 w-20 rounded-full border border-rule object-cover"
        />
      ) : (
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-leaf-soft font-display text-2xl text-leaf">
          {fullName.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div>
        <label className="inline-flex cursor-pointer rounded-lg border border-leaf px-3 py-2 text-sm font-medium text-leaf hover:bg-leaf-soft">
          {isPending ? "Uploading…" : photoUrl ? "Replace photo" : "Upload photo"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleChange}
            disabled={isPending}
            className="sr-only"
          />
        </label>
        <p className="mt-1 text-xs text-ink-soft">JPEG, PNG, or WebP · max 5 MB</p>
        {error && <p className="mt-1 text-xs text-clay">{error}</p>}
      </div>
    </div>
  );
}
