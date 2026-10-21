"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitPaymentClaim } from "@/lib/actions/paymentClaims";
import { emitToast } from "@/lib/toast";
import { unwrapAction } from "@/lib/actionResult";
import {
  invoiceReference,
  koboToNairaInput,
  lagosToday,
  nairaToKobo,
  type BankDetails,
} from "@/lib/paymentClaims";
import { formatKobo } from "@/types/database";

export interface LatestClaim {
  status: "pending" | "confirmed" | "rejected";
  amountKobo: number;
  sentOn: string;
  rejectReason: string | null;
}

/**
 * "Pay by bank transfer" for one invoice: shows the school's account and the
 * narration code, then a short "I've sent it" form. Sending the form does not
 * pay anything; the school confirms it after checking its bank statement.
 */
export function BankTransferPanel({
  invoiceId,
  balanceKobo,
  bank,
  latestClaim,
}: {
  invoiceId: string;
  balanceKobo: number;
  bank: BankDetails;
  latestClaim: LatestClaim | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(koboToNairaInput(balanceKobo));
  const [sentOn, setSentOn] = useState(() => lagosToday());
  const [senderName, setSenderName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const reference = invoiceReference(invoiceId);

  if (latestClaim?.status === "pending") {
    return (
      <p className="rounded-lg bg-marigold/10 px-3 py-2 text-xs text-ink">
        Waiting for the school to confirm your transfer of {formatKobo(latestClaim.amountKobo)} sent
        on {latestClaim.sentOn}. You&apos;ll see it under payment history once it is confirmed.
      </p>
    );
  }

  function submit() {
    setError(null);
    const amountKobo = nairaToKobo(amount);
    if (amountKobo === null) {
      setError("Enter the amount you sent, for example 25000.");
      return;
    }
    startTransition(async () => {
      try {
        await unwrapAction(submitPaymentClaim({ invoiceId, amountKobo, sentOn, senderName }));
        emitToast("Thank you. The school will confirm your transfer.");
        setOpen(false);
        router.refresh();
      } catch (err: any) {
        setError(err.message ?? "Something went wrong.");
      }
    });
  }

  return (
    <div className="space-y-2">
      {latestClaim?.status === "rejected" && (
        <p className="rounded-lg bg-clay/10 px-3 py-2 text-xs text-clay">
          The school could not confirm your last transfer of {formatKobo(latestClaim.amountKobo)}
          {latestClaim.rejectReason ? `: ${latestClaim.rejectReason}` : "."} You can send the
          details again below.
        </p>
      )}

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg border border-rule px-3 py-1.5 text-xs font-medium text-ink hover:bg-paper"
        >
          Pay by bank transfer
        </button>
      ) : (
        <div className="space-y-3 rounded-lg border border-rule bg-paper p-3 text-xs text-ink">
          <div>
            <p className="font-medium">Send {formatKobo(balanceKobo)} (or part of it) to:</p>
            <dl className="mt-1 grid grid-cols-[auto,1fr] gap-x-3 gap-y-0.5">
              <dt className="text-ink-soft">Bank</dt>
              <dd>{bank.bankName}</dd>
              <dt className="text-ink-soft">Account name</dt>
              <dd>{bank.accountName}</dd>
              <dt className="text-ink-soft">Account number</dt>
              <dd className="font-mono">{bank.accountNumber}</dd>
              <dt className="text-ink-soft">Narration</dt>
              <dd className="font-mono">{reference}</dd>
            </dl>
            <p className="mt-1 text-ink-soft">
              Put the narration code in the transfer so the school can find it. Then tell us below.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <label className="block">
              <span className="text-ink-soft">Amount sent (₦)</span>
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-0.5 w-full rounded-lg border border-rule px-2 py-1"
              />
            </label>
            <label className="block">
              <span className="text-ink-soft">Date sent</span>
              <input
                type="date"
                value={sentOn}
                max={lagosToday()}
                onChange={(e) => setSentOn(e.target.value)}
                className="mt-0.5 w-full rounded-lg border border-rule px-2 py-1"
              />
            </label>
            <label className="block">
              <span className="text-ink-soft">Name on your account</span>
              <input
                value={senderName}
                maxLength={120}
                onChange={(e) => setSenderName(e.target.value)}
                className="mt-0.5 w-full rounded-lg border border-rule px-2 py-1"
              />
            </label>
          </div>

          {error && <p className="text-clay">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={isPending}
              className="rounded-lg bg-leaf px-3 py-1.5 font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {isPending ? "Sending…" : "I've sent it"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={isPending}
              className="rounded-lg border border-rule px-3 py-1.5 text-ink hover:bg-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
