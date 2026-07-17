import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StudentDetailTabs } from "@/components/StudentDetailTabs";

export default async function StudentDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { studentId: string };
}) {
  const supabase = createClient();

  const { data: student } = await supabase
    .from("student_profiles")
    .select("admission_no, profiles(full_name)")
    .eq("id", params.studentId)
    .single();

  return (
    <div>
      <div className="mb-4 flex items-center gap-1 text-sm text-ink-soft">
        <Link href="/dashboard/admin/students" className="text-leaf hover:underline">
          Students
        </Link>
        <span>/</span>
        <span className="text-ink">
          {student?.profiles?.full_name ?? "Student"}
          {student?.admission_no ? ` (${student.admission_no})` : ""}
        </span>
      </div>

      <StudentDetailTabs studentId={params.studentId} />

      {children}
    </div>
  );
}
