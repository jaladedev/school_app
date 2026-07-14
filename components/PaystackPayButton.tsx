"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { verifyPaystackPayment } from "@/lib/actions/fees";

declare global {
  interface Window {
    PaystackPop?: {
      setup: (config: Record<string, any>) => { openIframe: () => void };
    };
  }
}

let scriptLoadingPromise: Promise<void> | null = null;

function loadPaystackScript(): Promise<void> {
  if (window.PaystackPop) return Promise.resolve();
  if (scriptLoadingPromise) return scriptLoadingPromise;

  scriptLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Paystack."));
    document.body.appendChild(script);
  });

  return scriptLoadingPromise;
}

export function PaystackPayButton({
  invoiceId,
  email,
  amountKobo,
}: {
  invoiceId: string;
  email: string;
  amountKobo: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handlePay() {
    setError(null);
    setLoading(true);

    try {
      await loadPaystackScript();
    } catch {
      setError("Could not load the payment window. Check your connection and try again.");
      setLoading(false);
      return;
    }

    const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
    if (!publicKey) {
      setError("Online payment isn't configured yet — please pay at the school office.");
      setLoading(false);
      return;
    }

    const handler = window.PaystackPop!.setup({
      key: publicKey,
      email,
      amount: amountKobo, // Paystack expects kobo directly for NGN
      currency: "NGN",
      ref: `inv_${invoiceId}_${Date.now()}`,
      callback: (response: { reference: string }) => {
        // This callback firing is a UI cue only — verifyPaystackPayment
        // re-checks the transaction against Paystack's own API server-side
        // before crediting anything, so a tampered client can't fake this.
        verifyPaystackPayment({ reference: response.reference, invoiceId })
          .then(() => {
            setSuccess(true);
            setLoading(false);
            router.refresh();
          })
          .catch((err) => {
            setError(err.message ?? "Payment made, but we couldn't verify it — contact admin.");
            setLoading(false);
          });
      },
      onClose: () => {
        setLoading(false);
      },
    });

    handler.openIframe();
  }

  if (success) {
    return <span className="text-xs font-medium text-leaf">Payment verified ✓</span>;
  }

  return (
    <div>
      <button
        onClick={handlePay}
        disabled={loading}
        className="rounded-lg bg-marigold px-3 py-1.5 text-xs font-medium text-ink hover:bg-marigold-dark disabled:opacity-60"
      >
        {loading ? "Opening…" : "Pay with card"}
      </button>
      {error && <p className="mt-1 text-xs text-clay">{error}</p>}
    </div>
  );
}