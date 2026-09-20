import { createHmac, timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env.server";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

type PaystackChargeEvent = {
  event?: string;
  data?: {
    amount?: number;
    currency?: string;
    reference?: string;
    metadata?: { invoiceId?: string } | null;
  };
};

function invoiceIdFromReference(reference: string): string | null {
  const match = /^inv_([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})_\d+$/i.exec(reference);
  return match?.[1] ?? null;
}

function hasValidSignature(payload: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;

  const expected = createHmac("sha512", secret).update(payload).digest("hex");
  const received = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  return received.length === expectedBuffer.length && timingSafeEqual(received, expectedBuffer);
}

export async function POST(request: Request) {
  const secret = serverEnv.PAYSTACK_SECRET_KEY;
  const payload = await request.text();
  if (!hasValidSignature(payload, request.headers.get("x-paystack-signature"), secret)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let event: PaystackChargeEvent;
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  // Paystack sends many event kinds. Only a successful charge may create a payment.
  if (event.event !== "charge.success") {
    return NextResponse.json({ received: true });
  }

  const reference = event.data?.reference;
  const amountKobo = event.data?.amount;
  const invoiceId =
    event.data?.metadata?.invoiceId ?? (reference ? invoiceIdFromReference(reference) : null);

  if (
    !invoiceId ||
    !reference ||
    typeof amountKobo !== "number" ||
    !Number.isSafeInteger(amountKobo) ||
    amountKobo <= 0 ||
    event.data?.currency !== "NGN"
  ) {
    return NextResponse.json({ error: "Invalid charge data." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("record_invoice_payment", {
    p_invoice_id: invoiceId,
    p_amount_kobo: amountKobo,
    p_method: "card",
    p_reference: reference,
    p_verified_by: null,
    p_enforce_balance: true,
  });

  if (!error) {
    revalidatePath("/dashboard/student/fees");
    revalidatePath("/dashboard/parent/fees");
    revalidatePath("/dashboard/admin/fees/invoices");
    return NextResponse.json({ received: true });
  }

  // A duplicate reference for this invoice is NOT an error path today --
  // record_invoice_payment() returns normally with already_recorded=true
  // in that case, so `error` here only ever reflects a genuine raise
  // exception from the RPC. The one business-rule outcome that can never
  // succeed on retry is the balance-mismatch guard (p_enforce_balance);
  // acknowledge that so Paystack stops re-delivering. Everything else is
  // treated as transient and gets a 5xx so Paystack retries.
  const msg: string = (error as { message?: string }).message ?? "";
  if (msg.includes("does not match what is owed on this invoice")) {
    logger.warn("paystack webhook: acknowledged non-retryable outcome", {
      reference,
      message: msg,
    });
    return NextResponse.json({ received: true, note: msg });
  }

  logger.error("paystack webhook: unable to record payment", { reference, error });
  return NextResponse.json({ error: "Unable to record payment." }, { status: 500 });
}
