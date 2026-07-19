"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { downloadCsv } from "@/lib/csv";
import { scoreToLetterGrade } from "@/types/database";

export function ExportGradeSheetButton({
  assessmentId,
  assessmentTitle,
  classId,
  maxScore,
}: {
  assessmentId: string;
  assessmentTitle: string;
  classId: string;
  maxScore: number;
}) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);

    const [{ data: roster }, { data: grades }, { data: settings }] = await Promise.all([
      supabase
        .from("student_profiles")
        .select("id, admission_no, profiles(full_name)")
        .eq("class_id", classId)
        .order("admission_no", { ascending: true }),
      supabase
        .from("grades")
        .select("student_id, score, moderation_status")
        .eq("assessment_id", assessmentId),
      supabase.from("school_settings").select("grade_scale").eq("id", 1).single(),
    ]);

    setLoading(false);

    if (!roster?.length) return;

    const gradeByStudent = new Map((grades ?? []).map((g) => [g.student_id, g]));
    const gradeScale = settings?.grade_scale ?? [];

    const headers = [
      "Full Name",
      "Admission No",
      `Score (out of ${maxScore})`,
      "Percent",
      "Letter Grade",
      "Status",
    ];

    const rows = roster.map((s) => {
      const grade = gradeByStudent.get(s.id);
      if (!grade) {
        return [s.profiles?.full_name ?? "", s.admission_no ?? "", "", "", "", "Not graded"];
      }
      const percent = maxScore > 0 ? (grade.score / maxScore) * 100 : 0;
      return [
        s.profiles?.full_name ?? "",
        s.admission_no ?? "",
        grade.score,
        percent.toFixed(1),
        gradeScale.length ? scoreToLetterGrade(percent, gradeScale) : "",
        grade.moderation_status === "approved" ? "Approved" : "Pending",
      ];
    });

    const safeTitle = assessmentTitle.trim().replace(/\s+/g, "-").toLowerCase();
    downloadCsv(
      `grade-sheet-${safeTitle}-${new Date().toISOString().slice(0, 10)}.csv`,
      headers,
      rows
    );
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="text-sm font-medium text-leaf hover:underline disabled:opacity-60"
    >
      {loading ? "Exporting…" : "Export sheet"}
    </button>
  );
}