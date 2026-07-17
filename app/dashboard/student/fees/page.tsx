import Link from "next/link";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { formatKobo, type InvoiceStatus, type PaymentMethod } from "@/types/database";
import { PaystackPayButton } from "@/components/PaystackPayButton";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  paid: "bg-leaf-soft text-leaf",
  partial: "bg-marigold/20 text-marigold-dark",
  unpaid: "bg-clay/10 text-clay",
};

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  card: "Card (Online)",
  other: "Other",
};

export default async function StudentFeesPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }
  const supabase = createClient();

  const { data: invoices } = await supabase
    .from("invoices")
    .select("*, fee_structures(title, due_date)")
    .eq("student_id", profile.id)
    .order("created_at", { ascending: false });

  const { data: payments } = await supabase
    .from("payments")
    .select("*, invoices(fee_structures(title))")
    .eq("student_id", profile.id)
    .order("paid_at", { ascending: false });

  const totalOwed = (invoices ?? []).reduce(
    (sum, i) => sum + (i.total_amount_kobo - i.discount_kobo),
    0
  );
  const totalPaid = (invoices ?? []).reduce((sum, i) => sum + i.amount_paid_kobo, 0);
  const totalBalance = totalOwed - totalPaid;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">Fees</h1>
      <p className="mb-6 text-sm text-ink-soft">Your invoices and payment history.</p>

      <div className="mb-6 rounded-xl border border-rule bg-white p-4">
        <p className="text-xs uppercase tracking-wide text-ink-soft">Outstanding balance</p>
        <p className={`font-display text-2xl font-semibold ${totalBalance > 0 ? "text-clay" : "text-leaf"}`}>
          {formatKobo(totalBalance)}
        </p>
        <p className="text-xs text-ink-soft">
          {formatKobo(totalPaid)} paid of {formatKobo(totalOwed)} total
        </p>
      </div>

      <h2 className="mb-2 font-display text-lg font-semibold text-ink">Invoices</h2>
      <div className="mb-8 space-y-2">
        {invoices?.map((inv) => {
          const feeStructure = inv.fee_structures;
          const owed = inv.total_amount_kobo - inv.discount_kobo;
          const balance = owed - inv.amount_paid_kobo;
          const status = inv.status as InvoiceStatus;

          return (
            <div key={inv.id} className="rounded-lg border border-rule bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-ink">{feeStructure?.title}</p>
                  <p className="text-xs text-ink-soft">
                    Term {inv.term} · {inv.academic_year}
                    {feeStructure?.due_date && ` · Due ${feeStructure.due_date}`}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${STATUS_STYLES[status]}`}>
                  {status}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-ink-soft">
                  {formatKobo(inv.amount_paid_kobo)} of {formatKobo(owed)} paid
                </span>
                {balance > 0 && (
                  <span className="font-medium text-clay">{formatKobo(balance)} due</span>
                )}
              </div>
              {balance > 0 && (
                <div className="mt-3">
                  <PaystackPayButton
                    invoiceId={inv.id}
                    email={profile.email}
                    amountKobo={balance}
                  />
                </div>
              )}
            </div>
          );
        })}

        {!invoices?.length && (
          <EmptyState message="No invoices yet." />
        )}
      </div>

      <h2 className="mb-2 font-display text-lg font-semibold text-ink">Payment history</h2>
      <div className="space-y-2">
        {payments?.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between rounded-lg border border-rule bg-white px-4 py-3"
          >
            <div>
              <p className="text-sm text-ink">
                {p.invoices?.fee_structures?.title ?? "Payment"}
              </p>
              <p className="text-xs text-ink-soft">
                {METHOD_LABELS[p.method as PaymentMethod]} ·{" "}
                {new Date(p.paid_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-medium text-leaf">{formatKobo(p.amount_kobo)}</span>
              <Link
                href={`/dashboard/receipt/${p.id}`}
                className="text-xs font-medium text-leaf hover:underline"
              >
                Receipt →
              </Link>
            </div>
          </div>
        ))}

        {!payments?.length && (
          <EmptyState message="No payments recorded yet." />
        )}
      </div>

      <p className="mt-6 text-xs text-ink-soft">
        You can pay online by card above, or at the school office by cash or bank transfer —
        office payments are recorded by staff and will show here once entered.
      </p>
    </div>
  );
}