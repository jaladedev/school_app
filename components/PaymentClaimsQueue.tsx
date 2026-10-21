"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmPaymentClaim, rejectPaymentClaim } from "@/lib/actions/paymentClaims";
import { emitToast } from "@/lib/toast";
import { unwrapAction } from "@/lib/actionResult";
import { koboToNairaInput, nairaToKobo } from "@/lib/paymentClaims";
import { formatKobo } from "@/types/database";

export interface PendingClaimRow {
  id: string;
  studentName: string;
  feeTitle: string;
  amountKobo: number;
  balanceKobo: number;
  sentOn: string;
  senderName: string;
  reference: string;
  createdAt: string;
}

function ClaimRow({ claim }: { claim: PendingClaimRow }) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "confirm" | "reject">("idle");
  const [amount, setAmount] = useState(koboToNairaInput(claim.amountKobo));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(task: () => Promise<unknown>, done: string) {
    setError(null);
    startTransition(async () => {
      try {
        await task();
        emitToast(done);
        router.refresh();
      } catch (err: any) {
        setError(err.message ?? "Something went wrong.");
      }
    });
  }

  function confirm() {
    const amountKobo = nairaToKobo(amount);
    if (amountKobo === null) {
      setError("Enter the amount that reached the account.");
      return;
    }
    run(
      () => unwrapAction(confirmPaymentClaim({ claimId: claim.id, amountKobo })),
      "Payment recorded."
    );
  }

  function reject() {
    run(() => unwrapAction(rejectPaymentClaim({ claimId: claim.id, reason })), "Claim rejected.");
  }

  return (
    <div className="rounded-lg border border-rule bg-white px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-ink">{claim.studentName}</p>
          <p className="text-xs text-ink-soft">
            {claim.feeTitle} · sent {claim.sentOn} by {claim.senderName}
          </p>
          <p className="mt-0.5 text-xs text-ink-soft">
            Narration <span className="font-mono">{claim.reference}</span> · still owed{" "}
            {formatKobo(claim.balanceKobo)}
          </p>
        </div>
        <span className="font-display text-lg font-semibold text-ink">
          {formatKobo(claim.amountKobo)}
        </span>
      </div>

      {mode === "idle" && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setMode("confirm")}
            className="rounded-lg bg-leaf px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
          >
            Money received
          </button>
          <button
            type="button"
            onClick={() => setMode("reject")}
            className="rounded-lg border border-rule px-3 py-1.5 text-xs font-medium text-ink hover:bg-paper"
          >
            Not received
          </button>
        </div>
      )}

      {mode === "confirm" && (
        <div className="mt-3 flex flex-wrap items-end gap-2 text-xs">
          <label className="block">
            <span className="text-ink-soft">Amount that reached the account (₦)</span>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-0.5 block w-40 rounded-lg border border-rule px-2 py-1"
            />
          </label>
          <button
            type="button"
            onClick={confirm}
            disabled={isPending}
            className="rounded-lg bg-leaf px-3 py-1.5 font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {isPending ? "Recording…" : "Record payment"}
          </button>
          <button
            type="button"
            onClick={() => setMode("idle")}
            disabled={isPending}
            className="rounded-lg border border-rule px-3 py-1.5 text-ink"
          >
            Back
          </button>
        </div>
      )}

      {mode === "reject" && (
        <div className="mt-3 flex flex-wrap items-end gap-2 text-xs">
          <label className="block grow">
            <span className="text-ink-soft">Reason (the payer will see this)</span>
            <input
              value={reason}
              maxLength={300}
              onChange={(e) => setReason(e.target.value)}
              placeholder="No matching credit on the statement"
              className="mt-0.5 block w-full rounded-lg border border-rule px-2 py-1"
            />
          </label>
          <button
            type="button"
            onClick={reject}
            disabled={isPending}
            className="rounded-lg bg-clay px-3 py-1.5 font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {isPending ? "Rejecting…" : "Reject claim"}
          </button>
          <button
            type="button"
            onClick={() => setMode("idle")}
            disabled={isPending}
            className="rounded-lg border border-rule px-3 py-1.5 text-ink"
          >
            Back
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-clay">{error}</p>}
    </div>
  );
}

export function PaymentClaimsQueue({ claims }: { claims: PendingClaimRow[] }) {
  return (
    <div className="space-y-2">
      {claims.map((c) => (
        <ClaimRow key={c.id} claim={c} />
      ))}
    </div>
  );
}
