"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function assertIsAdmin() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    throw new Error("Only an admin can create accounts.");
  }
}

function generateTempPassword() {
  const words = ["river", "otter", "cedar", "maple", "coral", "amber", "birch", "delta"];
  const word = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(10 + Math.random() * 89);
  return `${word}-${num}-${words[Math.floor(Math.random() * words.length)]}`;
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

async function recordEnrollment(
  admin: ReturnType<typeof createAdminClient>,
  studentId: string,
  classId: string
) {
  const { academicYear, term } = await getCurrentTermYear(admin);

  await admin.from("enrollments").upsert(
    {
      student_id: studentId,
      class_id: classId,
      academic_year: academicYear,
      term,
    },
    { onConflict: "student_id,class_id,academic_year,term" }
  );
}

export async function createTeacherAccount(input: {
  fullName: string;
  email: string;
  temporaryPassword: string;
  subjectIds: string[];
}) {
  await assertIsAdmin();
  const admin = createAdminClient();

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
    await admin.auth.admin.deleteUser(userId);
    throw new Error(profileError.message);
  }

  const { error: teacherError } = await admin.from("teacher_profiles").insert({
    id: userId,
    subjects_taught: input.subjectIds,
    hire_date: new Date().toISOString().slice(0, 10),
  });

  if (teacherError) {
    await admin.auth.admin.deleteUser(userId);
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
  await assertIsAdmin();

  if (!input.classId) {
    throw new Error("Please select a class before creating the student.");
  }

  const admin = createAdminClient();

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
    await admin.auth.admin.deleteUser(userId);
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
    await admin.auth.admin.deleteUser(userId);
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

export async function createStudentsBulk(input: {
  classId: string;
  students: BulkStudentRow[];
  passwordStrategy: "auto" | "shared";
  sharedPassword?: string;
}): Promise<BulkStudentResult[]> {
  await assertIsAdmin();

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

  const results: BulkStudentResult[] = [];

  for (const row of input.students) {
    const password =
      input.passwordStrategy === "shared" ? input.sharedPassword! : generateTempPassword();

    try {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: row.email,
        password,
        email_confirm: true,
      });

      if (createError || !created.user) {
        results.push({
          email: row.email,
          fullName: row.fullName,
          success: false,
          error: createError?.message ?? "Account creation failed.",
        });
        continue;
      }

      const userId = created.user.id;

      const { error: profileError } = await admin.from("profiles").insert({
        id: userId,
        role: "student",
        full_name: row.fullName,
        email: row.email,
      });

      if (profileError) {
        await admin.auth.admin.deleteUser(userId);
        results.push({
          email: row.email,
          fullName: row.fullName,
          success: false,
          error: profileError.message,
        });
        continue;
      }

      const { error: studentError } = await admin.from("student_profiles").insert({
        id: userId,
        class_id: input.classId,
        admission_no: row.admissionNo ?? null,
        guardian_name: row.guardianName ?? null,
        guardian_phone: row.guardianPhone ?? null,
      });

      if (studentError) {
        await admin.auth.admin.deleteUser(userId);
        results.push({
          email: row.email,
          fullName: row.fullName,
          success: false,
          error: studentError.message,
        });
        continue;
      }

      await recordEnrollment(admin, userId, input.classId);

      results.push({
        email: row.email,
        fullName: row.fullName,
        success: true,
        password,
      });
    } catch (err: any) {
      results.push({
        email: row.email,
        fullName: row.fullName,
        success: false,
        error: err.message ?? "Unexpected error.",
      });
    }
  }

  revalidatePath("/dashboard/admin/students");
  return results;
}

export async function reassignStudentClass(studentId: string, classId: string) {
  await assertIsAdmin();

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
  await assertIsAdmin();
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

// ---------- Edit teacher ----------

export async function updateTeacherAccount(input: { teacherId: string; fullName: string }) {
  await assertIsAdmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from("profiles")
    .update({ full_name: input.fullName })
    .eq("id", input.teacherId);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/admin/staff");
}

// ---------- Deactivation (any role) ----------

export async function deactivateUser(userId: string, deactivate: boolean) {
  await assertIsAdmin();
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
}

// ---------- Promotion ----------

export type PromotionOutcome = "promote" | "repeat" | "graduate";

export async function promoteStudents(input: {
  studentIds: string[];
  targetClassId: string | null;
  outcome: PromotionOutcome;
}) {
  await assertIsAdmin();
  const admin = createAdminClient();

  if (input.outcome !== "graduate" && !input.targetClassId) {
    throw new Error("Select a target class for promotion or repeat.");
  }

  const { academicYear, term } = await getCurrentTermYear(admin);

  let succeeded = 0;
  const errors: string[] = [];

  for (const studentId of input.studentIds) {
    if (input.outcome === "graduate") {
      const { error } = await admin
        .from("student_profiles")
        .update({ class_id: null })
        .eq("id", studentId);
      if (error) {
        errors.push(`${studentId}: ${error.message}`);
        continue;
      }
      succeeded += 1;
      continue;
    }

    const { error: updateError } = await admin
      .from("student_profiles")
      .update({ class_id: input.targetClassId })
      .eq("id", studentId);

    if (updateError) {
      errors.push(`${studentId}: ${updateError.message}`);
      continue;
    }

    await admin.from("enrollments").upsert(
      {
        student_id: studentId,
        class_id: input.targetClassId!,
        academic_year: academicYear,
        term,
      },
      { onConflict: "student_id,class_id,academic_year,term" }
    );

    succeeded += 1;
  }

  revalidatePath("/dashboard/admin/classes");
  revalidatePath("/dashboard/admin/students");

  return { succeeded, failed: errors.length, errors };
}

// ---------- Password reset ----------

export async function resetUserPassword(userId: string): Promise<{ password: string }> {
  await assertIsAdmin();
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

  return { password: newPassword };
}