"use client";

import { useState, useTransition } from "react";
import { savePaymentSettings } from "@/lib/actions/paymentClaims";
import { emitToast } from "@/lib/toast";
import { unwrapAction } from "@/lib/actionResult";
import {
  PAYMENT_METHOD_OPTIONS,
  normalizePaymentMethods,
  type PaymentMethods,
} from "@/lib/paymentClaims";
import type { SchoolSettings } from "@/types/database";

type Initial = Pick<
  SchoolSettings,
  | "payment_methods"
  | "bank_name"
  | "bank_account_name"
  | "bank_account_number"
  | "payment_notify_chat_id"
>;

/** How parents pay: which methods are shown, the school's bank account, and the Telegram chat for claims. */
export function PaymentSettingsForm({ initial }: { initial: Initial }) {
  const [methods, setMethods] = useState<PaymentMethods>(
    normalizePaymentMethods(initial.payment_methods)
  );
  const [bankName, setBankName] = useState(initial.bank_name ?? "");
  const [accountName, setAccountName] = useState(initial.bank_account_name ?? "");
  const [accountNumber, setAccountNumber] = useState(initial.bank_account_number ?? "");
  const [chatId, setChatId] = useState(initial.payment_notify_chat_id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await unwrapAction(
          savePaymentSettings({
            paymentMethods: methods,
            bankName,
            accountName,
            accountNumber,
            notifyChatId: chatId,
          })
        );
        emitToast("Payment settings saved.");
      } catch (err: any) {
        setError(err.message ?? "Something went wrong.");
      }
    });
  }

  const field = "mt-1 w-full rounded-lg border border-rule px-3 py-2 text-sm";

  return (
    <div className="rounded-xl border border-rule bg-white p-4">
      <h2 className="font-display text-lg font-semibold text-ink">How parents pay</h2>
      <p className="mt-1 text-xs text-ink-soft">
        With bank transfer, a parent sends the money and taps &quot;I&apos;ve sent it&quot;. Nothing
        is credited until you or the bursar confirm it under Payment claims.
      </p>

      <label className="mt-4 block text-sm">
        <span className="font-medium text-ink">Payment methods shown</span>
        <select
          value={methods}
          onChange={(e) => setMethods(e.target.value as PaymentMethods)}
          className={field}
        >
          {PAYMENT_METHOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="font-medium text-ink">Bank</span>
          <input value={bankName} onChange={(e) => setBankName(e.target.value)} className={field} />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-ink">Account name</span>
          <input
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            className={field}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-ink">Account number</span>
          <input
            inputMode="numeric"
            maxLength={10}
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            className={field}
          />
        </label>
      </div>

      <label className="mt-4 block text-sm">
        <span className="font-medium text-ink">Telegram chat id for new claims (optional)</span>
        <input
          value={chatId}
          onChange={(e) => setChatId(e.target.value)}
          placeholder="e.g. 123456789"
          className={field}
        />
        <span className="mt-1 block text-xs text-ink-soft">
          The bursar gets a Telegram message when a claim arrives. Needs the bot token set on the
          server; without it, claims just wait in the queue.
        </span>
      </label>

      {error && <p className="mt-3 text-sm text-clay">{error}</p>}

      <button
        type="button"
        onClick={save}
        disabled={isPending}
        className="mt-4 rounded-lg bg-leaf px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
      >
        {isPending ? "Saving…" : "Save payment settings"}
      </button>
    </div>
  );
}
