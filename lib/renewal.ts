// Pure helpers for the licence renewal screen. No server imports, so client
// components and unit tests can use them.
import { nairaToKobo } from "@/lib/paymentClaims";

export const PROOF_MAX_BYTES = 5 * 1024 * 1024;
export const PROOF_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;

/** A message for a file that cannot be a proof, or null when it can. */
export function proofFileProblem(file: { type: string; size: number }): string | null {
  if (!(PROOF_TYPES as readonly string[]).includes(file.type)) {
    return "A proof can be a JPEG, PNG or WebP photo, or a PDF.";
  }
  if (file.size < 1) return "That file is empty.";
  if (file.size > PROOF_MAX_BYTES) return "A proof must be 5 MB or smaller.";
  return null;
}

export type RenewalClaimInput = {
  reference: string;
  amountKobo: number;
  sentOn: string;
  senderName: string;
  payerReference?: string;
};

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Checks what a bursar typed into the "I have paid by transfer" form. The control
 * plane checks again; this gives the answer without a round trip.
 */
export function parseRenewalClaim(
  raw: {
    reference: string;
    amountText: string;
    sentOn: string;
    senderName: string;
    payerReference: string;
  },
  today: Date = new Date()
): { ok: true; value: RenewalClaimInput } | { ok: false; error: string } {
  const reference = raw.reference.trim();
  if (!/^SUB-[0-9A-F]{8}$/.test(reference)) {
    return { ok: false, error: "Choose which invoice you paid." };
  }
  const amountKobo = nairaToKobo(raw.amountText);
  if (amountKobo === null) {
    return { ok: false, error: "Enter the amount you sent, for example 150,000 or 150000.50." };
  }
  const sentOn = raw.sentOn.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sentOn) || Number.isNaN(Date.parse(sentOn))) {
    return { ok: false, error: "Enter the date you sent the payment." };
  }
  const day = Date.parse(sentOn);
  if (day > Date.parse(isoDay(today)) + 86_400_000) {
    return { ok: false, error: "The date you sent the payment cannot be in the future." };
  }
  if (day < Date.parse(isoDay(today)) - 90 * 86_400_000) {
    return {
      ok: false,
      error: "That date is more than 90 days ago. Ask support to check the payment.",
    };
  }
  const senderName = raw.senderName.trim();
  if (senderName.length < 2 || senderName.length > 120) {
    return { ok: false, error: "Enter the name on the account the money was sent from." };
  }
  const payerReference = raw.payerReference.trim();
  if (payerReference.length > 120) {
    return { ok: false, error: "The bank reference is too long." };
  }
  return {
    ok: true,
    value: {
      reference,
      amountKobo,
      sentOn,
      senderName,
      ...(payerReference ? { payerReference } : {}),
    },
  };
}

/** A fresh id for one claim, so pressing the button twice sends one claim. */
export const newClaimRef = () => `claim-${crypto.randomUUID()}`;
