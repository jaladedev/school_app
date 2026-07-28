"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertRole } from "@/lib/actions/authGuards";
import { HOMEWORK_SUBMISSION_BUCKET } from "@/lib/storageBuckets";

const MAX_SUBMISSION_BYTES = 20 * 1024 * 1024;
const ALLOWED_SUBMISSION_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

/** Student: upload (or replace, while still 'submitted') a homework file for a lesson. */
export async function submitHomework(lessonId: string, formData: FormData) {
  const { id: studentId } = await assertRole(["student"], "Only students can submit homework.");

  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) throw new Error("Choose a file to upload.");
  if (file.size > MAX_SUBMISSION_BYTES) throw new Error("Submissions must be 20 MB or smaller.");
  if (!ALLOWED_SUBMISSION_TYPES.has(file.type))
    throw new Error("Use an image (JPEG/PNG/WebP) or a PDF file.");

  const supabase = createClient();

  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, class_id, homework")
    .eq("id", lessonId)
    .single();
  if (!lesson || !lesson.homework) throw new Error("This lesson has no homework to submit.");

  const { data: studentProfile } = await supabase
    .from("student_profiles")
    .select("class_id")
    .eq("id", studentId)
    .single();
  if (!studentProfile || studentProfile.class_id !== lesson.class_id) {
    throw new Error("This homework isn't for your class.");
  }

  const admin = createAdminClient();
  const { error: bucketError } = await admin.storage.createBucket(HOMEWORK_SUBMISSION_BUCKET, {
    public: false,
    fileSizeLimit: `${MAX_SUBMISSION_BYTES}`,
    allowedMimeTypes: [...ALLOWED_SUBMISSION_TYPES],
  });
  if (bucketError && !/already exists/i.test(bucketError.message))
    throw new Error(bucketError.message);

  // If a pending (not-yet-reviewed) submission already exists, remove its
  // old file before replacing — resubmission is allowed up until review.
  const { data: existing } = await admin
    .from("homework_submissions")
    .select("id, file_url, status")
    .eq("lesson_id", lessonId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (existing && existing.status !== "submitted") {
    throw new Error("This homework has already been reviewed and can no longer be resubmitted.");
  }

  const extension =
    file.name
      .split(".")
      .pop()
      ?.replace(/[^a-z0-9]/gi, "") || "file";
  const objectPath = `${lessonId}/${studentId}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await admin.storage
    .from(HOMEWORK_SUBMISSION_BUCKET)
    .upload(objectPath, file, { contentType: file.type });
  if (uploadError) throw new Error(uploadError.message);

  if (existing) {
    const { error: updateError } = await admin
      .from("homework_submissions")
      .update({
        file_url: objectPath,
        file_name: file.name,
        submitted_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (updateError) {
      await admin.storage.from(HOMEWORK_SUBMISSION_BUCKET).remove([objectPath]);
      throw new Error(updateError.message);
    }
    // Best-effort cleanup of the previous file; not fatal if it fails.
    await admin.storage.from(HOMEWORK_SUBMISSION_BUCKET).remove([existing.file_url]);
  } else {
    const { error: insertError } = await admin.from("homework_submissions").insert({
      lesson_id: lessonId,
      student_id: studentId,
      file_url: objectPath,
      file_name: file.name,
    });
    if (insertError) {
      await admin.storage.from(HOMEWORK_SUBMISSION_BUCKET).remove([objectPath]);
      throw new Error(insertError.message);
    }
  }

  revalidatePath("/dashboard/student/homework");
}

/** Teacher/admin: leave a remark and mark a submission reviewed. */
export async function reviewHomeworkSubmission(submissionId: string, remark: string) {
  const { id: teacherId } = await assertRole(
    ["teacher", "admin"],
    "Only a teacher or admin can review homework."
  );

  const supabase = createClient();

  const { data: submission } = await supabase
    .from("homework_submissions")
    .select("id, lesson_id, lessons(teacher_id)")
    .eq("id", submissionId)
    .single();

  if (!submission) throw new Error("Submission not found.");
  if (submission.lessons?.teacher_id !== teacherId) {
    // assertRole already allows admin through; only enforce ownership for teachers
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", teacherId)
      .single();
    if (profile?.role !== "admin") {
      throw new Error("You aren't the teacher assigned to this lesson.");
    }
  }

  const { error } = await supabase
    .from("homework_submissions")
    .update({
      status: "reviewed",
      teacher_remark: remark.trim() || null,
      reviewed_by: teacherId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", submissionId);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/teacher/homework");
}
