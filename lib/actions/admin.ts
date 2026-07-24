"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertRole } from "@/lib/actions/authGuards";
import type { StaffRole } from "@/types/database";

const TEMP_PASSWORD_WORDS = [
  "acorn",
  "amber",
  "atlas",
  "basil",
  "birch",
  "cedar",
  "cobalt",
  "coral",
  "daisy",
  "delta",
  "ember",
  "fern",
  "fable",
  "glade",
  "harbor",
  "honey",
  "ivory",
  "juniper",
  "lagoon",
  "lumen",
  "maple",
  "marble",
  "meadow",
  "noble",
  "ocean",
  "olive",
  "orchid",
  "pearl",
  "pine",
  "quartz",
  "river",
  "rose",
  "sable",
  "spruce",
  "stone",
  "tulip",
  "verve",
  "willow",
  "zenith",
];

function generateTempPassword() {
  const segments = Array.from({ length: 4 }, () => {
    const index = crypto.randomInt(TEMP_PASSWORD_WORDS.length);
    return TEMP_PASSWORD_WORDS[index];
  });
  const suffix = crypto.randomInt(100, 999).toString();

  return `${segments.join("-")}-${suffix}`;
}

// Supabase Auth would reject a true duplicate anyway, but checking first
// gives a clear, specific error instead of surfacing Auth's raw message,
// and avoids an auth.admin.createUser call (and the compensating cleanup
// path) we already know will fail.
async function assertEmailAvailable(admin: ReturnType<typeof createAdminClient>, email: string) {
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  if (existing) {
    throw new Error(`An account with the email "${email}" already exists.`);
  }
}

async function getCurrentTermYear(admin: ReturnType<typeof createAdminClient>) {
  const { data } = await admin
    .from("school_settings")
    .select("current_academic_year, current_term")
    .eq("id", 1)
    .single();

  return {
    academicYear: data?.current_academic_year ?? "unknown",
    term: data?.current_term ?? 1,
  };
}

async function cleanupOrphanedAuthUsers(admin: ReturnType<typeof createAdminClient>) {
  const { data: profileRows, error: profileListError } = await admin.from("profiles").select("id");

  if (profileListError) {
    throw new Error(profileListError.message);
  }

  const profileIds = new Set((profileRows ?? []).map((row) => row.id));

  const { data: usersPage, error: listUsersError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (listUsersError) {
    throw new Error(listUsersError.message);
  }

  const deletedIds: string[] = [];
  const errors: string[] = [];

  for (const user of usersPage?.users ?? []) {
    if (profileIds.has(user.id)) continue;

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      errors.push(`${user.id}: ${deleteError.message}`);
      continue;
    }

    deletedIds.push(user.id);
  }

  return { deletedIds, errors };
}

// Deletes the auth user, falling back to an orphan sweep if the delete
// itself fails, and always surfaces the *original* error to the caller
// rather than whatever went wrong during cleanup. Shared by every
// account-creation flow so the failure-handling behavior stays identical
// across teacher/student/parent creation instead of drifting between them.
async function deleteUserAfterFailedSetup(
  admin: ReturnType<typeof createAdminClient>,
  userId: string
) {
  try {
    await admin.auth.admin.deleteUser(userId);
  } catch {
    await cleanupOrphanedAuthUsers(admin).catch(() => undefined);
  }
}

async function recordEnrollment(
  admin: ReturnType<typeof createAdminClient>,
  studentId: string,
  classId: string
) {
  await recordEnrollments(admin, [studentId], classId);
}

async function recordEnrollments(
  admin: ReturnType<typeof createAdminClient>,
  studentIds: string[],
  classId: string
) {
  if (!studentIds.length) return;

  const { academicYear, term } = await getCurrentTermYear(admin);

  const { error } = await admin.from("enrollments").upsert(
    studentIds.map((studentId) => ({
      student_id: studentId,
      class_id: classId,
      academic_year: academicYear,
      term,
    })),
    { onConflict: "student_id,academic_year,term" }
  );

  if (error) throw new Error(error.message);
}

async function mapWithConcurrency<T, R>(
  values: T[],
  limit: number,
  mapper: (value: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex++;
      results[index] = await mapper(values[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker));
  return results;
}

export async function createTeacherAccount(input: {
  fullName: string;
  email: string;
  temporaryPassword: string;
  subjectIds: string[];
}) {
  await assertRole(["admin"], "Only an admin can perform this action.");
  const admin = createAdminClient();
  await assertEmailAvailable(admin, input.email);

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.temporaryPassword,
    email_confirm: true,
  });

  if (createError || !created.user) {
    throw new Error(createError?.message ?? "Failed to create the auth account.");
  }

  const userId = created.user.id;

  const { error: profileError } = await admin.from("profiles").insert({
    id: userId,
    role: "teacher",
    full_name: input.fullName,
    email: input.email,
  });

  if (profileError) {
    await deleteUserAfterFailedSetup(admin, userId);
    throw new Error(profileError.message);
  }

  const { error: teacherError } = await admin.from("teacher_profiles").insert({
    id: userId,
    subjects_taught: input.subjectIds,
    hire_date: new Date().toISOString().slice(0, 10),
  });

  if (teacherError) {
    await deleteUserAfterFailedSetup(admin, userId);
    throw new Error(teacherError.message);
  }

  revalidatePath("/dashboard/admin/staff");
  return { userId };
}

export async function createStudentAccount(input: {
  fullName: string;
  email: string;
  temporaryPassword: string;
  classId: string;
  admissionNo?: string;
  guardianName?: string;
  guardianPhone?: string;
}) {
  await assertRole(["admin"], "Only an admin can perform this action.");

  if (!input.classId) {
    throw new Error("Please select a class before creating the student.");
  }

  const admin = createAdminClient();
  await assertEmailAvailable(admin, input.email);

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.temporaryPassword,
    email_confirm: true,
  });

  if (createError || !created.user) {
    throw new Error(createError?.message ?? "Failed to create the auth account.");
  }

  const userId = created.user.id;

  const { error: profileError } = await admin.from("profiles").insert({
    id: userId,
    role: "student",
    full_name: input.fullName,
    email: input.email,
  });

  if (profileError) {
    await deleteUserAfterFailedSetup(admin, userId);
    throw new Error(profileError.message);
  }

  const { error: studentError } = await admin.from("student_profiles").insert({
    id: userId,
    class_id: input.classId,
    admission_no: input.admissionNo ?? null,
    guardian_name: input.guardianName ?? null,
    guardian_phone: input.guardianPhone ?? null,
  });

  if (studentError) {
    await deleteUserAfterFailedSetup(admin, userId);
    throw new Error(studentError.message);
  }

  await recordEnrollment(admin, userId, input.classId);

  revalidatePath("/dashboard/admin/students");
  return { userId };
}

export type BulkStudentRow = {
  fullName: string;
  email: string;
  admissionNo?: string;
  guardianName?: string;
  guardianPhone?: string;
};

export type BulkStudentResult = {
  email: string;
  fullName: string;
  success: boolean;
  password?: string;
  error?: string;
};

type BulkCreationAttempt =
  | BulkStudentResult
  | {
      result: BulkStudentResult;
      userId: string;
    };

export async function createStudentsBulk(input: {
  classId: string;
  students: BulkStudentRow[];
  passwordStrategy: "auto" | "shared";
  sharedPassword?: string;
}): Promise<BulkStudentResult[]> {
  await assertRole(["admin"], "Only an admin can perform this action.");

  if (!input.classId) {
    throw new Error("Please select a class before creating students.");
  }

  const admin = createAdminClient();

  if (
    input.passwordStrategy === "shared" &&
    (!input.sharedPassword || input.sharedPassword.length < 8)
  ) {
    throw new Error("Shared password must be at least 8 characters.");
  }

  const emails = input.students.map((student) => student.email.trim().toLowerCase());
  const duplicateInputEmails = new Set(
    emails.filter((email, index) => emails.indexOf(email) !== index)
  );

  // Fetch every existing profile email and compare case-insensitively in
  // JS. A `.in("email", [...])` query does an exact-case match, so it
  // would silently miss a DB row like "John@Example.com" against an
  // import row of "john@example.com" — this avoids that gap. Fine at
  // school-roster scale; if `profiles` ever got huge, this would want to
  // become a targeted case-insensitive query instead.
  const { data: allProfiles, error: existingProfilesError } = await admin
    .from("profiles")
    .select("email");

  if (existingProfilesError) throw new Error(existingProfilesError.message);

  const existingEmails = new Set((allProfiles ?? []).map((profile) => profile.email.toLowerCase()));

  const created = await mapWithConcurrency<BulkStudentRow, BulkCreationAttempt>(
    input.students,
    5,
    async (row) => {
      const password =
        input.passwordStrategy === "shared" ? input.sharedPassword! : generateTempPassword();

      try {
        const email = row.email.trim().toLowerCase();
        if (existingEmails.has(email) || duplicateInputEmails.has(email)) {
          return {
            email: row.email,
            fullName: row.fullName,
            success: false,
            error: `An account with the email "${row.email}" already exists.`,
          } satisfies BulkStudentResult;
        }

        const { data: created, error: createError } = await admin.auth.admin.createUser({
          email: row.email,
          password,
          email_confirm: true,
        });

        if (createError || !created.user) {
          return {
            email: row.email,
            fullName: row.fullName,
            success: false,
            error: createError?.message ?? "Account creation failed.",
          } satisfies BulkStudentResult;
        }

        const userId = created.user.id;

        const { error: profileError } = await admin.from("profiles").insert({
          id: userId,
          role: "student",
          full_name: row.fullName,
          email: row.email,
        });

        if (profileError) {
          await deleteUserAfterFailedSetup(admin, userId);
          return {
            email: row.email,
            fullName: row.fullName,
            success: false,
            error: profileError.message,
          } satisfies BulkStudentResult;
        }

        const { error: studentError } = await admin.from("student_profiles").insert({
          id: userId,
          class_id: input.classId,
          admission_no: row.admissionNo ?? null,
          guardian_name: row.guardianName ?? null,
          guardian_phone: row.guardianPhone ?? null,
        });

        if (studentError) {
          await deleteUserAfterFailedSetup(admin, userId);
          return {
            email: row.email,
            fullName: row.fullName,
            success: false,
            error: studentError.message,
          } satisfies BulkStudentResult;
        }

        return {
          result: { email: row.email, fullName: row.fullName, success: true, password },
          userId,
        };
      } catch (err: any) {
        return {
          email: row.email,
          fullName: row.fullName,
          success: false,
          error: err.message ?? "Unexpected error.",
        } satisfies BulkStudentResult;
      }
    }
  );

  const successful = created.filter(
    (row): row is { result: BulkStudentResult; userId: string } => "userId" in row
  );

  await recordEnrollments(
    admin,
    successful.map((row) => row.userId),
    input.classId
  );

  const results = created.map((row) => ("result" in row ? row.result : row));

  revalidatePath("/dashboard/admin/students");
  return results;
}

export async function reassignStudentClass(studentId: string, classId: string) {
  await assertRole(["admin"], "Only an admin can perform this action.");

  if (!classId) {
    throw new Error("Please select a valid class.");
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("student_profiles")
    .update({ class_id: classId })
    .eq("id", studentId);

  if (error) throw new Error(error.message);

  await recordEnrollment(admin, studentId, classId);

  revalidatePath("/dashboard/admin/students");
}

// ---------- Edit student ----------

export async function updateStudentAccount(input: {
  studentId: string;
  fullName: string;
  admissionNo?: string;
  guardianName?: string;
  guardianPhone?: string;
  classId?: string;
}) {
  await assertRole(["admin"], "Only an admin can perform this action.");
  const admin = createAdminClient();

  const { error: profileError } = await admin
    .from("profiles")
    .update({ full_name: input.fullName })
    .eq("id", input.studentId);

  if (profileError) throw new Error(profileError.message);

  const { error: studentError } = await admin
    .from("student_profiles")
    .update({
      admission_no: input.admissionNo || null,
      guardian_name: input.guardianName || null,
      guardian_phone: input.guardianPhone || null,
      ...(input.classId ? { class_id: input.classId } : {}),
    })
    .eq("id", input.studentId);

  if (studentError) throw new Error(studentError.message);

  if (input.classId) {
    await recordEnrollment(admin, input.studentId, input.classId);
  }

  revalidatePath(`/dashboard/admin/students/${input.studentId}`);
  revalidatePath("/dashboard/admin/students");
}

const STUDENT_PHOTO_BUCKET = "student-photos";
const MAX_STUDENT_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_STUDENT_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

async function ensureStudentPhotoBucket(admin: ReturnType<typeof createAdminClient>) {
  const { error } = await admin.storage.createBucket(STUDENT_PHOTO_BUCKET, {
    public: false,
    fileSizeLimit: `${MAX_STUDENT_PHOTO_BYTES}`,
    allowedMimeTypes: [...ALLOWED_STUDENT_PHOTO_TYPES],
  });

  if (error && !/already exists/i.test(error.message)) {
    throw new Error(`Could not prepare student photo storage: ${error.message}`);
  }
}

export async function uploadStudentPhoto(studentId: string, formData: FormData) {
  await assertRole(["admin"], "Only an admin can upload student photos.");

  const photo = formData.get("photo");
  if (!(photo instanceof File) || !photo.size) throw new Error("Choose an image to upload.");
  if (!ALLOWED_STUDENT_PHOTO_TYPES.has(photo.type)) {
    throw new Error("Use a JPEG, PNG, or WebP image.");
  }
  if (photo.size > MAX_STUDENT_PHOTO_BYTES) throw new Error("The photo must be 5 MB or smaller.");

  const admin = createAdminClient();
  await ensureStudentPhotoBucket(admin);

  const { data: profile, error: profileReadError } = await admin
    .from("profiles")
    .select("avatar_url")
    .eq("id", studentId)
    .single();

  if (profileReadError || !profile) throw new Error("Student profile not found.");

  const extension = photo.type === "image/jpeg" ? "jpg" : photo.type.split("/")[1];
  const objectPath = `${studentId}/profile.${extension}`;
  const { error: uploadError } = await admin.storage
    .from(STUDENT_PHOTO_BUCKET)
    .upload(objectPath, photo, {
      contentType: photo.type,
      upsert: true,
    });

  if (uploadError) throw new Error(uploadError.message);

  const { error: updateError } = await admin
    .from("profiles")
    .update({ avatar_url: objectPath })
    .eq("id", studentId);

  if (updateError) {
    await admin.storage.from(STUDENT_PHOTO_BUCKET).remove([objectPath]);
    throw new Error(updateError.message);
  }

  if (profile.avatar_url && profile.avatar_url !== objectPath) {
    await admin.storage.from(STUDENT_PHOTO_BUCKET).remove([profile.avatar_url]);
  }

  revalidatePath(`/dashboard/admin/students/${studentId}`);
  revalidatePath("/dashboard/admin/students");
}

// ---------- Edit teacher ----------

export async function updateTeacherAccount(input: { teacherId: string; fullName: string }) {
  await assertRole(["admin"], "Only an admin can perform this action.");
  const admin = createAdminClient();

  const { error } = await admin
    .from("profiles")
    .update({ full_name: input.fullName })
    .eq("id", input.teacherId);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/admin/staff");
  revalidatePath(`/dashboard/admin/staff/${input.teacherId}`);
}

export async function updateTeacherSubjects(teacherId: string, subjectIds: string[]) {
  await assertRole(["admin"], "Only an admin can update teacher subjects.");
  const admin = createAdminClient();
  const uniqueSubjectIds = [...new Set(subjectIds.filter(Boolean))];

  const { data: subjects, error: subjectsError } = uniqueSubjectIds.length
    ? await admin.from("subjects").select("id").in("id", uniqueSubjectIds)
    : { data: [], error: null };

  if (subjectsError) throw new Error(subjectsError.message);
  if ((subjects ?? []).length !== uniqueSubjectIds.length) {
    throw new Error("One or more selected subjects no longer exist.");
  }

  const { error } = await admin
    .from("teacher_profiles")
    .update({ subjects_taught: uniqueSubjectIds })
    .eq("id", teacherId);

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/admin/staff/${teacherId}`);
  revalidatePath("/dashboard/admin/staff");
  revalidatePath("/dashboard/admin/classes");
}

export async function updateTeacherStaffRole(teacherId: string, staffRole: StaffRole) {
  await assertRole(["admin"], "Only an admin can assign staff roles.");
  const admin = createAdminClient();
  const { error } = await admin
    .from("teacher_profiles")
    .update({ staff_role: staffRole })
    .eq("id", teacherId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/admin/staff");
  revalidatePath(`/dashboard/admin/staff/${teacherId}`);
}

// ---------- Parent accounts ----------

export type ParentChildLink = {
  studentId: string;
  relationship: string;
  isPrimary: boolean;
};

export async function createParentAccount(input: {
  fullName: string;
  email: string;
  temporaryPassword: string;
  children: ParentChildLink[];
}) {
  await assertRole(["admin"], "Only an admin can perform this action.");

  if (!input.children.length) {
    throw new Error("Link at least one child before creating the account.");
  }

  const admin = createAdminClient();
  await assertEmailAvailable(admin, input.email);

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.temporaryPassword,
    email_confirm: true,
  });

  if (createError || !created.user) {
    throw new Error(createError?.message ?? "Failed to create the auth account.");
  }

  const userId = created.user.id;

  const { error: profileError } = await admin.from("profiles").insert({
    id: userId,
    role: "parent",
    full_name: input.fullName,
    email: input.email,
  });

  if (profileError) {
    await deleteUserAfterFailedSetup(admin, userId);
    throw new Error(profileError.message);
  }

  const { error: linksError } = await admin.from("guardian_links").insert(
    input.children.map((c) => ({
      parent_id: userId,
      student_id: c.studentId,
      relationship: c.relationship || null,
      is_primary: c.isPrimary,
    }))
  );

  if (linksError) {
    await deleteUserAfterFailedSetup(admin, userId);
    throw new Error(linksError.message);
  }

  revalidatePath("/dashboard/admin/parents");
  return { userId };
}

export async function addChildToParent(parentId: string, studentId: string, relationship?: string) {
  await assertRole(["admin"], "Only an admin can perform this action.");
  const admin = createAdminClient();

  const { error } = await admin.from("guardian_links").insert({
    parent_id: parentId,
    student_id: studentId,
    relationship: relationship || null,
    is_primary: false,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/admin/parents");
  revalidatePath(`/dashboard/admin/parents/${parentId}`);
}

export async function removeChildFromParent(guardianLinkId: string) {
  await assertRole(["admin"], "Only an admin can perform this action.");
  const admin = createAdminClient();

  const { error } = await admin.from("guardian_links").delete().eq("id", guardianLinkId);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/admin/parents");
}

// ---------- Deactivation (any role) ----------

export async function deactivateUser(userId: string, deactivate: boolean) {
  await assertRole(["admin"], "Only an admin can perform this action.");
  const admin = createAdminClient();

  // ban_duration actually blocks sign-in at the auth level. "none" lifts
  // an existing ban; a long duration ("87600h" ≈ 10 years) is Supabase's
  // recommended way to represent an indefinite ban, since the API has no
  // literal "forever" value.
  const { error: authError } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: deactivate ? "87600h" : "none",
  });

  if (authError) throw new Error(authError.message);

  const { error: profileError } = await admin
    .from("profiles")
    .update({ is_active: !deactivate })
    .eq("id", userId);

  if (profileError) throw new Error(profileError.message);

  revalidatePath("/dashboard/admin/staff");
  revalidatePath("/dashboard/admin/students");
  revalidatePath("/dashboard/admin/parents");
  revalidatePath(`/dashboard/admin/staff/${userId}`);
  revalidatePath(`/dashboard/admin/students/${userId}`);
}

// ---------- Promotion ----------

export type PromotionOutcome = "promote" | "repeat" | "graduate";

export async function promoteStudents(input: {
  studentIds: string[];
  targetClassId: string | null;
  outcome: PromotionOutcome;
}) {
  await assertRole(["admin"], "Only an admin can perform this action.");
  const admin = createAdminClient();

  if (input.outcome !== "graduate" && !input.targetClassId) {
    throw new Error("Select a target class for promotion or repeat.");
  }

  const studentIds = [...new Set(input.studentIds)];
  if (!studentIds.length) return { succeeded: 0, failed: 0, errors: [] };

  const { data: updatedStudents, error: updateError } = await admin
    .from("student_profiles")
    .update({ class_id: input.outcome === "graduate" ? null : input.targetClassId! })
    .in("id", studentIds)
    .select("id");

  if (updateError) throw new Error(updateError.message);

  const updatedIds = (updatedStudents ?? []).map((student) => student.id);
  const missingIds = studentIds.filter((id) => !updatedIds.includes(id));
  const errors = missingIds.map((id) => `${id}: Student not found or could not be updated.`);

  if (input.outcome !== "graduate" && updatedIds.length) {
    await recordEnrollments(admin, updatedIds, input.targetClassId!);
  }

  revalidatePath("/dashboard/admin/classes");
  revalidatePath("/dashboard/admin/students");

  return { succeeded: updatedIds.length, failed: errors.length, errors };
}

// ---------- Password reset ----------

export async function resetUserPassword(userId: string): Promise<{ password: string }> {
  await assertRole(["admin"], "Only an admin can perform this action.");
  const admin = createAdminClient();

  const newPassword = generateTempPassword();

  const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (updateError) throw new Error(updateError.message);

  const { error: profileError } = await admin
    .from("profiles")
    .update({ must_change_password: true })
    .eq("id", userId);

  if (profileError) throw new Error(profileError.message);

  revalidatePath("/dashboard/admin/staff");
  revalidatePath("/dashboard/admin/students");
  revalidatePath("/dashboard/admin/parents");
  revalidatePath(`/dashboard/admin/staff/${userId}`);
  revalidatePath(`/dashboard/admin/students/${userId}`);

  return { password: newPassword };
}
