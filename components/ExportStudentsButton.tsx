"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function ExportStudentsButton() {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);

    // Fetches the FULL list, not just whatever page the admin currently
    // has open — an export limited to one page of 25 wouldn't be useful.
    const { data: students } = await supabase
      .from("student_profiles")
      .select("admission_no, guardian_name, guardian_phone, profiles(full_name, email), classes(name, arm)")
      .order("admission_no", { ascending: true });

    setLoading(false);

    if (!students) return;

    const headers = ["Full Name", "Email", "Admission No", "Class", "Guardian Name", "Guardian Phone"];
    const rows = students.map((s) => {
      const profile = s.profiles;
      const cls = s.classes;
      return [
        profile?.full_name ?? "",
        profile?.email ?? "",
        s.admission_no ?? "",
        cls ? `${cls.name} ${cls.arm ?? ""}`.trim() : "",
        s.guardian_name ?? "",
        s.guardian_phone ?? "",
      ]
        .map((field) => escapeCsvField(String(field)))
        .join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `students-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="rounded-lg border border-rule px-4 py-2 text-sm font-medium text-ink hover:bg-paper disabled:opacity-60"
    >
      {loading ? "Exporting…" : "Export CSV"}
    </button>
  );
}