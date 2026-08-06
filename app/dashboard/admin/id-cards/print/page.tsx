import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { IdCardBatch, type IdCardData } from "@/components/IdCardBatch";
import { formatLevel } from "@/types/database";
import { STUDENT_PHOTO_BUCKET } from "@/lib/storageBuckets";

async function signStudentPhotos(paths: (string | null)[]): Promise<Map<string, string>> {
  const admin = createAdminClient();
  const distinctPaths = [...new Set(paths.filter((p): p is string => !!p))];
  const urlByPath = new Map<string, string>();

  await Promise.all(
    distinctPaths.map(async (path) => {
      const { data } = await admin.storage
        .from(STUDENT_PHOTO_BUCKET)
        .createSignedUrl(path, 60 * 60);
      if (data?.signedUrl) urlByPath.set(path, data.signedUrl);
    })
  );

  return urlByPath;
}

export default async function IdCardsPrintPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    classId?: string;
    studentId?: string;
    teacherId?: string;
  }>;
}) {
  const resolvedSearchParams = await searchParams;
  const supabase = createClient();

  const { data: settings } = await supabase
    .from("school_settings")
    .select("name, motto, logo_url, current_academic_year")
    .eq("id", 1)
    .single();

  let cards: IdCardData[] = [];

  if (resolvedSearchParams.type === "students" && resolvedSearchParams.studentId) {
    // Single-card mode, e.g. from a student's own detail page — same
    // shape as the class query below, just filtered to one id instead
    // of a whole class.
    const { data: students } = await supabase
      .from("student_profiles")
      .select(
        "id, admission_no, profiles(full_name, avatar_url), classes(name, arm, education_level, level_number)"
      )
      .eq("id", resolvedSearchParams.studentId);

    const photoUrlByPath = await signStudentPhotos(
      (students ?? []).map((s) => s.profiles?.avatar_url ?? null)
    );

    cards = (students ?? []).map((s) => ({
      id: s.id,
      fullName: s.profiles?.full_name ?? "Unknown",
      role: "Student",
      idNumber: s.admission_no,
      subLabel: s.classes
        ? `${s.classes.name} ${s.classes.arm ?? ""} · ${formatLevel(s.classes.education_level, s.classes.level_number)}`
        : null,
      photoUrl: s.profiles?.avatar_url ? (photoUrlByPath.get(s.profiles.avatar_url) ?? null) : null,
    }));
  } else if (resolvedSearchParams.type === "students" && resolvedSearchParams.classId) {
    const { data: students } = await supabase
      .from("student_profiles")
      .select(
        "id, admission_no, profiles(full_name, avatar_url), classes(name, arm, education_level, level_number)"
      )
      .eq("class_id", resolvedSearchParams.classId)
      .order("admission_no", { ascending: true });

    const photoUrlByPath = await signStudentPhotos(
      (students ?? []).map((s) => s.profiles?.avatar_url ?? null)
    );

    cards = (students ?? []).map((s) => ({
      id: s.id,
      fullName: s.profiles?.full_name ?? "Unknown",
      role: "Student",
      idNumber: s.admission_no,
      subLabel: s.classes
        ? `${s.classes.name} ${s.classes.arm ?? ""} · ${formatLevel(s.classes.education_level, s.classes.level_number)}`
        : null,
      photoUrl: s.profiles?.avatar_url ? (photoUrlByPath.get(s.profiles.avatar_url) ?? null) : null,
    }));
  } else if (resolvedSearchParams.type === "staff" && resolvedSearchParams.teacherId) {
    const { data: teachers } = await supabase
      .from("teacher_profiles")
      .select("id, staff_id, staff_role, profiles!inner(full_name, is_active)")
      .eq("id", resolvedSearchParams.teacherId);

    cards = (teachers ?? []).map((t) => ({
      id: t.id,
      fullName: t.profiles?.full_name ?? "Unknown",
      role: "Teacher",
      idNumber: t.staff_id,
      subLabel: t.staff_role && t.staff_role !== "teacher" ? t.staff_role.toUpperCase() : null,
      photoUrl: null,
    }));
  } else if (resolvedSearchParams.type === "staff") {
    const { data: teachers } = await supabase
      .from("teacher_profiles")
      .select("id, staff_id, staff_role, profiles!inner(full_name, is_active)")
      .eq("profiles.is_active", true)
      .order("staff_id", { ascending: true });

    cards = (teachers ?? []).map((t) => ({
      id: t.id,
      fullName: t.profiles?.full_name ?? "Unknown",
      role: "Teacher",
      idNumber: t.staff_id,
      subLabel: t.staff_role && t.staff_role !== "teacher" ? t.staff_role.toUpperCase() : null,
      // No staff photo bucket exists yet — only student-photos does. Falls
      // back to initials, same as a student with no photo uploaded.
      photoUrl: null,
    }));
  }

  return (
    <IdCardBatch
      schoolName={settings?.name ?? "School Name"}
      schoolMotto={settings?.motto ?? null}
      logoUrl={settings?.logo_url ?? null}
      academicYear={settings?.current_academic_year ?? ""}
      cards={cards}
    />
  );
}
