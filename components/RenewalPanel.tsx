"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startRenewalCardPayment, submitRenewalClaim } from "@/lib/actions/renewal";
import { unwrapAction } from "@/lib/actionResult";
import { emitToast } from "@/lib/toast";
import { koboToNairaInput, lagosToday } from "@/lib/paymentClaims";
import { PROOF_MAX_BYTES, PROOF_TYPES, newClaimRef, proofFileProblem } from "@/lib/renewal";
import { formatKobo } from "@/types/database";

export type RenewalInvoice = {
  reference: string;
  session: string;
  amountKobo: number;
  status: "pending" | "pending_confirmation";
  validUntil: string;
  lines: { label: string; quantity: number; totalKobo: number }[];
};

/**
 * One open invoice: what it is for, how to pay it by card, and the short "I have paid
 * by transfer" form. Sending the form pays nothing; the operator checks their bank and
 * confirms, and the licence updates then.
 */
export function RenewalPanel({
  invoice,
  payTo,
  cardEnabled,
  proofEnabled,
}: {
  invoice: RenewalInvoice;
  payTo: { name: string; lines: string[] };
  cardEnabled: boolean;
  proofEnabled: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // One id per form, made when it opens, so pressing Send twice sends one claim.
  const [clientRef, setClientRef] = useState(() => newClaimRef());

  function payByCard() {
    setError(null);
    startTransition(async () => {
      try {
        const { url } = await unwrapAction(
          startRenewalCardPayment({ reference: invoice.reference })
        );
        window.location.href = url;
      } catch (err: any) {
        setError(err.message ?? "Something went wrong.");
      }
    });
  }

  function send(form: HTMLFormElement) {
    setError(null);
    const data = new FormData(form);
    const file = data.get("proof");
    if (file instanceof File && file.size > 0) {
      const problem = proofFileProblem({ type: file.type, size: file.size });
      if (problem) {
        setError(problem);
        return;
      }
    } else {
      data.delete("proof");
    }
    startTransition(async () => {
      try {
        await unwrapAction(submitRenewalClaim(data));
        emitToast("Thank you. We will confirm your payment once we see it in our bank.");
        setOpen(false);
        setClientRef(newClaimRef());
        router.refresh();
      } catch (err: any) {
        setError(err.message ?? "Something went wrong.");
      }
    });
  }

  const waiting = invoice.status === "pending_confirmation";

  return (
    <section className="space-y-3 rounded-lg border border-rule bg-white p-4 text-sm text-ink">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">Licence for {invoice.session}</h2>
        <span className="font-mono text-xs text-ink-soft">{invoice.reference}</span>
      </header>

      <ul className="divide-y divide-rule">
        {invoice.lines.map((l, i) => (
          <li key={i} className="flex justify-between gap-4 py-1.5">
            <span>
              {l.label}
              {l.quantity > 1 ? ` × ${l.quantity}` : ""}
            </span>
            <span>{formatKobo(l.totalKobo)}</span>
          </li>
        ))}
        <li className="flex justify-between gap-4 py-1.5 font-semibold">
          <span>Total (valid until {invoice.validUntil})</span>
          <span>{formatKobo(invoice.amountKobo)}</span>
        </li>
      </ul>

      {waiting ? (
        <p className="rounded-lg bg-marigold/10 px-3 py-2 text-xs">
          A payment for this invoice has been sent to us and is being checked. Your licence updates
          as soon as it is confirmed.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {cardEnabled && (
              <button
                type="button"
                disabled={isPending}
                onClick={payByCard}
                className="rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
              >
                {isPending ? "Opening…" : `Pay ${formatKobo(invoice.amountKobo)} by card`}
              </button>
            )}
            {!open && (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="rounded-lg border border-rule px-3 py-1.5 text-xs font-medium hover:bg-paper"
              >
                Pay by bank transfer
              </button>
            )}
          </div>

          {open && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(e.currentTarget);
              }}
              className="space-y-3 rounded-lg border border-rule bg-paper p-3 text-xs"
            >
              <div>
                <p className="font-medium">Send {formatKobo(invoice.amountKobo)} to:</p>
                <p className="mt-1 whitespace-pre-line">
                  {[payTo.name, ...payTo.lines].filter(Boolean).join("\n") ||
                    "Ask us for our bank details."}
                </p>
                <p className="mt-1">
                  Narration: <span className="font-mono">{invoice.reference}</span>
                </p>
                <p className="mt-1 text-ink-soft">
                  Put the narration in the transfer so we can find it. Then tell us below.
                </p>
              </div>
              <input type="hidden" name="reference" value={invoice.reference} />
              <input type="hidden" name="clientRef" value={clientRef} />
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="block">
                  <span className="text-ink-soft">Amount sent (₦)</span>
                  <input
                    name="amount"
                    inputMode="decimal"
                    defaultValue={koboToNairaInput(invoice.amountKobo)}
                    className="mt-0.5 w-full rounded-lg border border-rule px-2 py-1"
                  />
                </label>
                <label className="block">
                  <span className="text-ink-soft">Date sent</span>
                  <input
                    name="sentOn"
                    type="date"
                    defaultValue={lagosToday()}
                    max={lagosToday()}
                    className="mt-0.5 w-full rounded-lg border border-rule px-2 py-1"
                  />
                </label>
                <label className="block">
                  <span className="text-ink-soft">Name on your account</span>
                  <input
                    name="senderName"
                    maxLength={120}
                    className="mt-0.5 w-full rounded-lg border border-rule px-2 py-1"
                  />
                </label>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className="text-ink-soft">Bank reference (optional)</span>
                  <input
                    name="payerReference"
                    maxLength={120}
                    className="mt-0.5 w-full rounded-lg border border-rule px-2 py-1"
                  />
                </label>
                {proofEnabled && (
                  <label className="block">
                    <span className="text-ink-soft">
                      Photo or PDF of the receipt (optional, up to {PROOF_MAX_BYTES / 1024 / 1024}{" "}
                      MB)
                    </span>
                    <input
                      name="proof"
                      type="file"
                      accept={PROOF_TYPES.join(",")}
                      className="mt-0.5 w-full text-xs"
                    />
                  </label>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-ink px-3 py-1.5 font-medium text-white disabled:opacity-60"
                >
                  {isPending ? "Sending…" : "I have sent it"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-rule px-3 py-1.5 hover:bg-white"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {error && <p className="rounded-lg bg-clay/10 px-3 py-2 text-xs text-clay">{error}</p>}
    </section>
  );
}
