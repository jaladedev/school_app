"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { downloadCsv } from "@/lib/csv";

export function ExportClassListButton({
  classId,
  className,
}: {
  classId: string;
  className: string;
}) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);

    const { data: students } = await supabase
      .from("student_profiles")
      .select("admission_no, guardian_name, guardian_phone, profiles(full_name, email)")
      .eq("class_id", classId)
      .order("admission_no", { ascending: true });

    setLoading(false);

    if (!students?.length) return;

    const headers = ["Full Name", "Email", "Admission No", "Guardian Name", "Guardian Phone"];
    const rows = students.map((s) => [
      s.profiles?.full_name ?? "",
      s.profiles?.email ?? "",
      s.admission_no ?? "",
      s.guardian_name ?? "",
      s.guardian_phone ?? "",
    ]);

    const safeClassName = className.trim().replace(/\s+/g, "-").toLowerCase();
    downloadCsv(
      `class-list-${safeClassName}-${new Date().toISOString().slice(0, 10)}.csv`,
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
      {loading ? "Exporting…" : "Export list"}
    </button>
  );
}