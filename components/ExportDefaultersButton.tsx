"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { downloadCsv } from "@/lib/csv";

export function ExportDefaultersButton() {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);

    const { data: invoices } = await supabase
      .from("invoices")
      .select(
        "total_amount_kobo, discount_kobo, amount_paid_kobo, status, term, academic_year, student_profiles(admission_no, guardian_phone, profiles(full_name)), fee_structures(title)"
      )
      .in("status", ["unpaid", "partial"])
      .order("student_id");

    setLoading(false);

    if (!invoices) return;

    const headers = [
      "Student Name",
      "Admission No",
      "Guardian Phone",
      "Fee",
      "Term",
      "Academic Year",
      "Amount Owed (₦)",
      "Amount Paid (₦)",
      "Balance (₦)",
      "Status",
    ];

    const rows = invoices.map((inv) => {
      const studentProfile = inv.student_profiles;
      const feeStructure = inv.fee_structures;
      const owed = (inv.total_amount_kobo - inv.discount_kobo) / 100;
      const paid = inv.amount_paid_kobo / 100;
      const balance = owed - paid;

      return [
        studentProfile?.profiles?.full_name ?? "",
        studentProfile?.admission_no ?? "",
        studentProfile?.guardian_phone ?? "",
        feeStructure?.title ?? "",
        String(inv.term),
        inv.academic_year,
        owed.toFixed(2),
        paid.toFixed(2),
        balance.toFixed(2),
        inv.status,
      ];
    });

    downloadCsv(`defaulters-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="rounded-lg border border-rule px-4 py-2 text-sm font-medium text-ink hover:bg-paper disabled:opacity-60"
    >
      {loading ? "Exporting…" : "Export defaulters"}
    </button>
  );
}
