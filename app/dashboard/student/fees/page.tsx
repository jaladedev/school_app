import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { formatKobo } from "@/types/database";
import type { InvoiceStatus } from "@/types/database";

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  paid: "bg-leaf-soft text-leaf",
  partial: "bg-marigold/20 text-marigold-dark",
  unpaid: "bg-clay/10 text-clay",
};

export default async function StudentFeesPage() {
  const profile = await getCurrentProfile();
  const supabase = createClient();

  const { data: invoices } = await supabase
    .from("invoices")
    .select("*, fee_structures(title, due_date)")
    .eq("student_id", profile!.id)
    .order("created_at", { ascending: false });

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

      <div className="space-y-2">
        {invoices?.map((inv) => {
          const feeStructure = (inv as any).fee_structures;
          const owed = inv.total_amount_kobo - inv.discount_kobo;
          const balance = owed - inv.amount_paid_kobo;

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
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${STATUS_STYLES[inv.status as InvoiceStatus]}`}>
                  {inv.status}
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
            </div>
          );
        })}

        {!invoices?.length && (
          <p className="text-sm text-ink-soft">No invoices yet.</p>
        )}
      </div>

      <p className="mt-6 text-xs text-ink-soft">
        Payments are recorded by the school office once received. Contact admin if a payment
        you've made isn't reflected here.
      </p>
    </div>
  );
}