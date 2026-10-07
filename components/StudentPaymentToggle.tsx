"use client";

import { useState, useTransition } from "react";
import { setStudentOnlinePayment } from "@/lib/actions/settings";
import { emitToast } from "@/lib/toast";

/**
 * Instant-save switch (no "Save settings" needed): flips optimistically and
 * rolls back with an error toast if the server refuses.
 */
export function StudentPaymentToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    startTransition(async () => {
      try {
        await setStudentOnlinePayment(next);
        emitToast(next ? "Students can now pay online." : "Students can no longer pay online.");
      } catch (err: any) {
        setEnabled(!next);
        emitToast(err.message ?? "Something went wrong.", "error");
      }
    });
  }

  return (
    <div className="rounded-xl border border-rule bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Online fee payment</h2>
          <p className="mt-1 text-sm font-medium text-ink">Let students pay their own fees</p>
          <p className="mt-1 text-xs text-ink-soft">
            Parents and guardians can always pay online. Students can always see their invoices;
            when this is off they just won&apos;t get the &quot;Pay with card&quot; button. When a
            student does pay, their linked guardians are emailed a copy of the payment.
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Let students pay their own fees online"
          onClick={toggle}
          disabled={isPending}
          className={`relative mt-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-marigold disabled:opacity-60 ${
            enabled ? "bg-leaf" : "bg-rule"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      <p
        className={`mt-3 inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
          enabled ? "bg-leaf-soft text-leaf" : "bg-clay/10 text-clay"
        }`}
      >
        {enabled ? "Students can pay online" : "Students can view only — parents pay"}
      </p>
    </div>
  );
}
