import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatKobo, type PaymentMethod } from "@/types/database";
import { EmptyState } from "@/components/EmptyState";
import { ExportDefaultersButton } from "@/components/ExportDefaultersButton";
import { SendFeeRemindersButton } from "@/components/SendFeeRemindersButton";

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  card: "Card (Online)",
  other: "Other",
};

export default async function BursarDashboardPage() {
  const supabase = createClient();

  const { data: settings } = await supabase
    .from("school_settings")
    .select("current_academic_year, current_term")
    .eq("id", 1)
    .single();

  const academicYear = settings?.current_academic_year;
  const term = settings?.current_term;

  // Same computation as the invoices page's KPI strip — kept independent
  // rather than shared, since this is a smaller read (no join, no list
  // rows) scoped only to what the dashboard cards need.
  let totalsQuery = supabase
    .from("invoices")
    .select("total_amount_kobo, discount_kobo, amount_paid_kobo, status")
    .is("voided_at", null);
  if (academicYear && term) {
    totalsQuery = totalsQuery.eq("academic_year", academicYear).eq("term", term);
  }
  const { data: totalsRows } = await totalsQuery;

  let totalBilled = 0;
  let totalCollected = 0;
  let unpaidInvoiceCount = 0;
  for (const row of totalsRows ?? []) {
    totalBilled += row.total_amount_kobo - row.discount_kobo;
    totalCollected += row.amount_paid_kobo;
    if (row.status !== "paid") unpaidInvoiceCount += 1;
  }
  const totalOutstanding = totalBilled - totalCollected;
  const collectionRatePercent = totalBilled ? Math.round((totalCollected / totalBilled) * 100) : 0;

  const { data: recentPayments } = await supabase
    .from("payments")
    .select("id, amount_kobo, method, paid_at, student_profiles(profiles(full_name))")
    .order("paid_at", { ascending: false })
    .limit(6);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink">Bursary</h1>
        <div className="flex gap-2">
          <ExportDefaultersButton />
          <SendFeeRemindersButton />
        </div>
      </div>
      <p className="mb-6 text-sm text-ink-soft">
        {academicYear && term ? `${academicYear}, term ${term}` : "Fee collection overview"}
      </p>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-lg border border-rule bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-ink-soft">Total billed</p>
          <p className="font-display text-lg font-semibold text-ink">{formatKobo(totalBilled)}</p>
        </div>
        <div className="rounded-lg border border-rule bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-ink-soft">Collected</p>
          <p className="font-display text-lg font-semibold text-leaf">
            {formatKobo(totalCollected)}
          </p>
        </div>
        <div className="rounded-lg border border-rule bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-ink-soft">Outstanding</p>
          <p className="font-display text-lg font-semibold text-clay">
            {formatKobo(totalOutstanding)}
          </p>
        </div>
        <div className="rounded-lg border border-rule bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-ink-soft">Unpaid invoices</p>
          <p className="font-display text-lg font-semibold text-ink">{unpaidInvoiceCount}</p>
        </div>
        <div className="rounded-lg border border-rule bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-ink-soft">Collection rate</p>
          <p className="font-display text-lg font-semibold text-ink">{collectionRatePercent}%</p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href="/dashboard/bursar/invoices"
          className="rounded-lg border border-rule px-4 py-2 text-sm font-medium text-ink hover:bg-paper"
        >
          Invoices &amp; payments
        </Link>
        <Link
          href="/dashboard/bursar/payments"
          className="rounded-lg border border-rule px-4 py-2 text-sm font-medium text-ink hover:bg-paper"
        >
          Payment history
        </Link>
        <Link
          href="/dashboard/bursar/structures"
          className="rounded-lg border border-rule px-4 py-2 text-sm font-medium text-ink hover:bg-paper"
        >
          Fee structures
        </Link>
      </div>

      <section>
        <h2 className="mb-2 font-display text-lg font-semibold text-ink">Recent payments</h2>
        <div className="space-y-2">
          {recentPayments?.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-rule bg-white px-4 py-3"
            >
              <div>
                <p className="font-medium text-ink">
                  {p.student_profiles?.profiles?.full_name ?? "Unknown"}
                </p>
                <p className="text-xs text-ink-soft">
                  {METHOD_LABELS[p.method as PaymentMethod]} ·{" "}
                  {new Date(p.paid_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-display text-lg font-semibold text-leaf">
                  {formatKobo(p.amount_kobo)}
                </span>
                <Link
                  href={`/dashboard/receipt/${p.id}`}
                  className="text-sm font-medium text-leaf hover:underline"
                >
                  Receipt →
                </Link>
              </div>
            </div>
          ))}
          {!recentPayments?.length && <EmptyState message="No payments recorded yet." />}
        </div>
      </section>
    </div>
  );
}
