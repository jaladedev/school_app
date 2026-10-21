import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/EmptyState";
import { PaymentClaimsQueue, type PendingClaimRow } from "@/components/PaymentClaimsQueue";
import { formatKobo } from "@/types/database";

// Claims waiting for a decision, then the most recent decisions. The layout
// lets admins and bursars in, and row security on payment_claims is the same.
export default async function PaymentClaimsPage() {
  const supabase = createClient();

  const { data: pending } = await supabase
    .from("payment_claims")
    .select(
      "id, amount_kobo, sent_on, sender_name, reference, created_at, student_id, invoices(total_amount_kobo, discount_kobo, amount_paid_kobo, fee_structures(title))"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const { data: decided } = await supabase
    .from("payment_claims")
    .select(
      "id, status, amount_kobo, confirmed_amount_kobo, sent_on, reject_reason, decided_at, student_id"
    )
    .neq("status", "pending")
    .order("decided_at", { ascending: false })
    .limit(20);

  const studentIds = [
    ...new Set([...(pending ?? []), ...(decided ?? [])].map((c) => c.student_id)),
  ];
  const { data: names } = studentIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", studentIds)
    : { data: [] as { id: string; full_name: string }[] };
  const nameOf = new Map((names ?? []).map((n) => [n.id, n.full_name]));

  const rows: PendingClaimRow[] = (pending ?? []).map((c) => {
    const inv = c.invoices;
    return {
      id: c.id,
      studentName: nameOf.get(c.student_id) ?? "Unknown",
      feeTitle: inv?.fee_structures?.title ?? "Invoice",
      amountKobo: c.amount_kobo,
      balanceKobo: inv ? inv.total_amount_kobo - inv.discount_kobo - inv.amount_paid_kobo : 0,
      sentOn: c.sent_on,
      senderName: c.sender_name,
      reference: c.reference,
      createdAt: c.created_at,
    };
  });

  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">Payment claims</h1>
      <p className="mb-6 text-sm text-ink-soft">
        Parents who say they have sent a bank transfer. Check your bank statement for the money,
        then confirm it. Nothing is credited until you do.
      </p>

      <h2 className="mb-2 font-display text-lg font-semibold text-ink">
        Waiting for you ({rows.length})
      </h2>
      <div className="mb-8">
        {rows.length > 0 ? (
          <PaymentClaimsQueue claims={rows} />
        ) : (
          <EmptyState message="No transfers waiting." />
        )}
      </div>

      <h2 className="mb-2 font-display text-lg font-semibold text-ink">Recently decided</h2>
      <div className="space-y-2">
        {decided?.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between rounded-lg border border-rule bg-white px-4 py-3"
          >
            <div>
              <p className="font-medium text-ink">{nameOf.get(c.student_id) ?? "Unknown"}</p>
              <p className="text-xs text-ink-soft">
                Sent {c.sent_on}
                {c.status === "rejected" && c.reject_reason ? ` · ${c.reject_reason}` : ""}
              </p>
            </div>
            <span
              className={`text-sm font-medium ${c.status === "confirmed" ? "text-leaf" : "text-clay"}`}
            >
              {c.status === "confirmed"
                ? `Confirmed ${formatKobo(c.confirmed_amount_kobo ?? c.amount_kobo)}`
                : "Rejected"}
            </span>
          </div>
        ))}
        {!decided?.length && <EmptyState message="Nothing decided yet." />}
      </div>
    </div>
  );
}
