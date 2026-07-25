import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { IssueLoanForm } from "@/components/IssueLoanForm";
import { ReturnLoanButton } from "@/components/ReturnLoanButton";
import { WaiveFineButton } from "@/components/WaiveFineButton";
import { EmptyState } from "@/components/EmptyState";
import { isLoanOverdue, formatKobo } from "@/types/database";

export default async function AdminLibraryLoansPage() {
  const supabase = createClient();

  const [{ data: books }, { data: students }, { data: loans }, { data: fines }] = await Promise.all(
    [
      supabase
        .from("library_books")
        .select("id, title, available_copies")
        .eq("is_archived", false)
        .order("title", { ascending: true }),
      supabase
        .from("student_profiles")
        .select("id, admission_no, profiles(full_name), classes(name, arm)")
        .order("admission_no", { ascending: true }),
      supabase
        .from("library_loans")
        .select("*, library_books(title), student_profiles(admission_no, profiles(full_name))")
        .is("returned_at", null)
        .order("due_at", { ascending: true }),
      supabase
        .from("invoices")
        .select(
          "id, total_amount_kobo, discount_kobo, amount_paid_kobo, created_at, student_profiles(admission_no, profiles(full_name)), fee_structures!inner(title)"
        )
        .eq("fee_structures.title", "Library Fine")
        .in("status", ["unpaid", "partial"])
        .order("created_at", { ascending: false }),
    ]
  );

  const studentOptions = (students ?? []).map((s) => ({
    id: s.id,
    label:
      `${s.profiles?.full_name ?? "Unknown"} — ${s.classes?.name ?? ""} ${s.classes?.arm ?? ""} (${s.admission_no ?? "no admission #"})`.trim(),
  }));

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink">Borrow / Return</h1>
        <Link href="/dashboard/library" className="text-sm font-medium text-leaf hover:underline">
          ← Catalog
        </Link>
      </div>
      <p className="mb-6 text-sm text-ink-soft">Issue new loans and record returns.</p>

      <IssueLoanForm books={books ?? []} students={studentOptions} />

      <h2 className="mb-2 font-display text-lg font-semibold text-ink">Active loans</h2>
      <div className="space-y-2">
        {(loans ?? []).map((loan) => {
          const overdue = isLoanOverdue(loan);
          return (
            <div
              key={loan.id}
              className={`flex items-center justify-between rounded-lg border bg-white px-4 py-3 ${
                overdue ? "border-clay" : "border-rule"
              }`}
            >
              <div>
                <p className="font-medium text-ink">
                  {loan.library_books?.title ?? "Unknown book"}
                </p>
                <p className="text-xs text-ink-soft">
                  {loan.student_profiles?.profiles?.full_name ?? "Unknown student"}
                  {loan.student_profiles?.admission_no
                    ? ` (${loan.student_profiles.admission_no})`
                    : ""}
                  {" · Due "}
                  {new Date(loan.due_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                  {overdue && <span className="ml-1 font-medium text-clay">· Overdue</span>}
                </p>
              </div>
              <ReturnLoanButton loanId={loan.id} />
            </div>
          );
        })}
        {!loans?.length && <EmptyState message="No active loans." />}
      </div>

      <h2 className="mb-2 mt-6 font-display text-lg font-semibold text-ink">
        Outstanding library fines
      </h2>
      <div className="space-y-2">
        {(fines ?? []).map((fine) => {
          const owed = fine.total_amount_kobo - fine.discount_kobo - fine.amount_paid_kobo;
          return (
            <div
              key={fine.id}
              className="flex items-center justify-between rounded-lg border border-rule bg-white px-4 py-3"
            >
              <div>
                <p className="font-medium text-ink">
                  {fine.student_profiles?.profiles?.full_name ?? "Unknown student"}
                  {fine.student_profiles?.admission_no
                    ? ` (${fine.student_profiles.admission_no})`
                    : ""}
                </p>
                <p className="text-xs text-ink-soft">{formatKobo(owed)} owed</p>
              </div>
              <WaiveFineButton invoiceId={fine.id} />
            </div>
          );
        })}
        {!fines?.length && <EmptyState message="No outstanding library fines." />}
      </div>
    </div>
  );
}
