// Folder names inside the school's R2 bucket (see lib/storage.ts). The
// exported constant names keep the old "BUCKET" wording because every call
// site already imports them; each one is now a folder, not a bucket.
export const HOMEWORK_SUBMISSION_BUCKET = "homework-submissions";
export const TOPIC_RESOURCE_BUCKET = "topic-resources";
export const STUDENT_PHOTO_BUCKET = "student-photos";
export const LIBRARY_BUCKET = "library-assets";

export type StorageFolder =
  | typeof HOMEWORK_SUBMISSION_BUCKET
  | typeof TOPIC_RESOURCE_BUCKET
  | typeof STUDENT_PHOTO_BUCKET
  | typeof LIBRARY_BUCKET;
