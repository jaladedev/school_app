import { RenewalPanel } from "@/components/RenewalPanel";
import { EmptyState } from "@/components/EmptyState";
import { STATUS_LABELS } from "@/lib/license";
import { getLicenseInfo } from "@/lib/licenseInfo";
import { loadRenewalData } from "@/lib/renewalData";
import { formatKobo } from "@/types/database";

// Renewing the school's licence: the invoices the operator has issued, and how to pay
// them. The bursar layout lets admins and bursars in. Nothing here is hidden when the
// licence has lapsed: a lapsed school must still be able to pay.
export const dynamic = "force-dynamic";

const formatDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString("en-NG", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—";

export default async function RenewalPage({
  searchParams,
}: {
  searchParams: Promise<{ card?: string }>;
}) {
  const { card } = await searchParams;
  const [info, renewal] = await Promise.all([getLicenseInfo(), loadRenewalData()]);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="mb-1 font-display text-2xl font-semibold text-ink">School licence</h1>
        <p className="text-sm text-ink-soft">
          Renew your school&rsquo;s subscription by card or bank transfer.
        </p>
      </div>

      {info.status !== "none" && (
        <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 text-sm">
          <dt className="text-ink-soft">Status</dt>
          <dd className="font-medium">
            {STATUS_LABELS[info.status]}
            {info.isTrial ? " (free trial)" : ""}
          </dd>
          <dt className="text-ink-soft">Valid until</dt>
          <dd>{formatDate(info.validUntil)}</dd>
          <dt className="text-ink-soft">Grace period ends</dt>
          <dd>{formatDate(info.graceUntil)}</dd>
        </dl>
      )}

      {card === "returned" && (
        <p className="rounded-lg bg-leaf/10 px-3 py-2 text-sm text-ink">
          Thank you. If your card payment went through, your licence updates within a minute or two.
          Reload this page to check.
        </p>
      )}

      {renewal.state === "not_set_up" && (
        <EmptyState message="Online renewal is not set up yet. Ask your administrator or support to finish setting it up. Until then, pay the invoice you were sent and let us know." />
      )}

      {renewal.state === "unavailable" && (
        <p className="rounded-lg bg-clay/10 px-3 py-2 text-sm text-clay">{renewal.message}</p>
      )}

      {renewal.state === "ready" && renewal.data.invoices.length === 0 && (
        <EmptyState message="Nothing to pay right now. There is no open invoice for your school. When one is issued it will appear here." />
      )}

      {renewal.state === "ready" &&
        renewal.data.invoices.map((inv) => (
          <RenewalPanel
            key={inv.reference}
            invoice={{
              reference: inv.reference,
              session: inv.session,
              amountKobo: inv.amount_kobo,
              status: inv.status,
              validUntil: inv.valid_until,
              lines: inv.lines.map((l) => ({
                label: l.label,
                quantity: l.quantity,
                totalKobo: l.total_kobo,
              })),
            }}
            payTo={renewal.data.pay_to}
            cardEnabled={renewal.data.card_enabled}
            proofEnabled={renewal.data.proof_enabled}
          />
        ))}

      {renewal.state === "ready" && renewal.receipts.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-display text-lg font-semibold text-ink">Past payments</h2>
          <ul className="divide-y divide-rule rounded-lg border border-rule bg-white text-sm">
            {renewal.receipts.map((r) => (
              <li
                key={r.reference}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5"
              >
                <span>
                  <span className="font-medium">{r.session}</span>{" "}
                  <span className="font-mono text-xs text-ink-soft">{r.reference}</span>
                </span>
                <span className="text-ink-soft">
                  {formatKobo(r.total_kobo)} · {formatDate(r.paid_at)}
                  {r.status === "refunded" ? " · refunded" : ""}
                </span>
                <a
                  href={`/dashboard/bursar/renewal/receipt/${r.reference}`}
                  className="text-xs font-medium text-ink underline"
                >
                  Receipt (PDF)
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
