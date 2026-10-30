"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { assertCanManageFees } from "@/lib/actions/fees";
import { getAuthenticatedUser } from "@/lib/actions/authGuards";
import { runAction } from "@/lib/actionResult";
import { writeAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { getControlPlaneConfig } from "@/lib/controlPlaneConfig";
import {
  ControlPlaneError,
  startCardCheckout,
  submitClaim,
  uploadProof,
} from "@/lib/controlPlaneClient";
import { parseRenewalClaim, proofFileProblem } from "@/lib/renewal";

const WHO_MESSAGE = "Only an admin or the bursar can renew the school's licence.";
const NOT_SET_UP = "Online renewal is not set up for this school yet. Ask support to set it up.";
const PAGE = "/dashboard/bursar/renewal";

// Deliberately allowed when the licence has LAPSED: the one thing a lapsed school
// must still be able to do is pay. A read-only support session is still refused
// (assertCanManageFees refuses it unless told otherwise).
const guard = () => assertCanManageFees(WHO_MESSAGE, { allowWhenExpired: true });

function config() {
  const cfg = getControlPlaneConfig();
  if (!cfg) throw new Error(NOT_SET_UP);
  return cfg;
}

/** Lets the worded messages through and hides anything unexpected behind a plain one. */
async function toPerson<T>(what: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ControlPlaneError) throw err;
    logger.error(`renewal: ${what} failed`, { error: err });
    throw new Error("Something went wrong. Please try again.");
  }
}

/**
 * "I have paid by transfer": sends the claim (and the proof, if there is one) to the
 * control plane. Nothing is credited here; the operator checks their bank and confirms.
 * The form carries one `clientRef`, so pressing the button twice sends one claim.
 */
export async function submitRenewalClaim(formData: FormData) {
  return runAction(async () => {
    await guard();
    const cfg = config();
    const user = await getAuthenticatedUser();
    if (!user.email) throw new Error("Your account has no email address to send the claim from.");

    const text = (k: string) => String(formData.get(k) ?? "");
    const parsed = parseRenewalClaim({
      reference: text("reference"),
      amountText: text("amount"),
      sentOn: text("sentOn"),
      senderName: text("senderName"),
      payerReference: text("payerReference"),
    });
    if (!parsed.ok) throw new Error(parsed.error);
    const clientRef = text("clientRef");
    if (!/^claim-[0-9a-f-]{36}$/.test(clientRef)) {
      throw new Error("Reload the page and try again.");
    }

    const file = formData.get("proof");
    let proofPath: string | undefined;
    if (file instanceof File && file.size > 0) {
      const problem = proofFileProblem({ type: file.type, size: file.size });
      if (problem) throw new Error(problem);
      const bytes = new Uint8Array(await file.arrayBuffer());
      proofPath = await toPerson("upload proof", () =>
        uploadProof(cfg, { type: file.type, bytes })
      );
    }

    const { claimId } = await toPerson("submit claim", () =>
      submitClaim(cfg, {
        subscriptionReference: parsed.value.reference,
        clientRef,
        amountKobo: parsed.value.amountKobo,
        sentOn: parsed.value.sentOn,
        senderName: parsed.value.senderName,
        payerReference: parsed.value.payerReference,
        proofPath,
        claimedBy: user.email!,
      })
    );
    await writeAuditLog({
      entityType: "license_claim",
      entityId: claimId,
      action: "license.claim_submitted",
      actorId: user.id,
      metadata: {
        invoice: parsed.value.reference,
        amount_kobo: parsed.value.amountKobo,
        with_proof: Boolean(proofPath),
      },
    });
    revalidatePath(PAGE);
  });
}

/** Starts a card payment for one invoice and returns the Paystack page to open. */
export async function startRenewalCardPayment(input: { reference: string }) {
  return runAction(async () => {
    await guard();
    const cfg = config();
    const user = await getAuthenticatedUser();
    if (!user.email) throw new Error("Your account has no email address to send the receipt to.");
    if (!/^SUB-[0-9A-F]{8}$/.test(input.reference)) throw new Error("Choose which invoice to pay.");

    // Where Paystack sends the payer afterwards: this same page, on the host they used.
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
    if (!/^[a-z0-9.-]+(:\d{1,5})?$/i.test(host)) throw new Error("Reload the page and try again.");
    const proto =
      (h.get("x-forwarded-proto") ?? "https").split(",")[0].trim() === "http" ? "http" : "https";
    const returnUrl = `${proto}://${host}${PAGE}?card=returned`;

    const { authorizationUrl } = await toPerson("start card payment", () =>
      startCardCheckout(cfg, { reference: input.reference, email: user.email!, returnUrl })
    );
    await writeAuditLog({
      entityType: "license_checkout",
      entityId: user.id,
      action: "license.card_checkout_started",
      actorId: user.id,
      metadata: { invoice: input.reference },
    });
    return { url: authorizationUrl };
  });
}
