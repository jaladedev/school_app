import { z } from "zod";
import { signClaim, type SignaturePurpose } from "@/lib/controlPlaneClaim";

// This school's server talking to the control plane about its licence: which
// invoices are open, a link to upload a proof of payment, a payment claim, a card
// checkout. Every request is signed with this school's own private key
// (lib/controlPlaneClaim.ts), so the control plane knows which school is asking and
// that the body was not changed on the way. The key never leaves the server.

export type ControlPlaneConfig = { baseUrl: string; slug: string; privateKey: string };

/** A failure whose message is safe, and worded, for the person at the screen. */
export class ControlPlaneError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ControlPlaneError";
  }
}

const NOT_RESPONDING = "The billing server is not responding. Try again in a moment.";

function friendly(status: number, serverMessage: unknown): string {
  if (status === 401) {
    return "The billing server did not accept this school's signing key. Ask support to check the key.";
  }
  if (status === 429) return "Too many attempts. Wait a minute and try again.";
  if ([400, 403, 409, 413, 502, 503].includes(status) && typeof serverMessage === "string") {
    return serverMessage.slice(0, 300);
  }
  return NOT_RESPONDING;
}

/** Plain http is only for a control plane running on this machine. */
function assertSafeUrl(url: URL) {
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new ControlPlaneError("The billing server address must be https.", 0);
  }
}

type Options = { fetchImpl?: typeof fetch; now?: Date };

/** Sends one signed request and returns the raw response. The caller decides how to read it. */
async function signedRequest(
  cfg: ControlPlaneConfig,
  path: string,
  purpose: SignaturePurpose,
  payload: Record<string, unknown>,
  opts: Options
): Promise<Response> {
  const url = new URL(path, cfg.baseUrl);
  assertSafeUrl(url);
  const body = JSON.stringify(payload);
  const timestamp = Math.floor((opts.now ?? new Date()).getTime() / 1000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    return await (opts.fetchImpl ?? fetch)(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-school-slug": cfg.slug,
        "x-claim-timestamp": String(timestamp),
        "x-claim-signature": signClaim({
          privateKey: cfg.privateKey,
          slug: cfg.slug,
          timestamp,
          body,
          purpose,
        }),
      },
      body,
      signal: controller.signal,
      redirect: "error",
    });
  } catch {
    throw new ControlPlaneError(NOT_RESPONDING, 0);
  } finally {
    clearTimeout(timer);
  }
}

export async function signedPost(
  cfg: ControlPlaneConfig,
  path: string,
  purpose: SignaturePurpose,
  payload: Record<string, unknown>,
  opts: Options = {}
): Promise<Record<string, unknown>> {
  const res = await signedRequest(cfg, path, purpose, payload, opts);
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || !json || json.ok !== true) {
    throw new ControlPlaneError(friendly(res.status, json?.error), res.status);
  }
  return json;
}

// ---------------------------------------------------------------------------
// Open invoices
// ---------------------------------------------------------------------------

const invoicesSchema = z.object({
  invoices: z.array(
    z.object({
      reference: z.string(),
      session: z.string(),
      amount_kobo: z.number().int(),
      status: z.enum(["pending", "pending_confirmation"]),
      valid_until: z.string(),
      lines: z.array(
        z.object({ label: z.string(), quantity: z.number(), total_kobo: z.number().int() })
      ),
    })
  ),
  pay_to: z.object({ name: z.string(), lines: z.array(z.string()) }),
  card_enabled: z.boolean(),
  proof_enabled: z.boolean(),
});
export type OpenInvoices = z.infer<typeof invoicesSchema>;

export async function fetchOpenInvoices(
  cfg: ControlPlaneConfig,
  opts: Options = {}
): Promise<OpenInvoices> {
  const json = await signedPost(cfg, "/api/invoices", "invoices-v1", {}, opts);
  const parsed = invoicesSchema.safeParse(json);
  if (!parsed.success) throw new ControlPlaneError(NOT_RESPONDING, 0);
  return parsed.data;
}

// ---------------------------------------------------------------------------
// Proof of payment
// ---------------------------------------------------------------------------

const uploadSchema = z.object({
  proof_path: z.string().min(1).max(300),
  upload_url: z.string().url(),
  upload_headers: z.record(z.string(), z.string()),
});

/**
 * Asks for a link, sends the file to it, and returns the path to name in the claim.
 * The file goes straight to the control plane's bucket with a link that is good for
 * five minutes and only for this type and size.
 */
export async function uploadProof(
  cfg: ControlPlaneConfig,
  file: { type: string; bytes: Uint8Array },
  opts: Options = {}
): Promise<string> {
  const json = await signedPost(
    cfg,
    "/api/claims/proof",
    "proof-v1",
    { content_type: file.type, size_bytes: file.bytes.byteLength },
    opts
  );
  const parsed = uploadSchema.safeParse(json);
  if (!parsed.success) throw new ControlPlaneError(NOT_RESPONDING, 0);
  const target = new URL(parsed.data.upload_url);
  assertSafeUrl(target);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const put = await (opts.fetchImpl ?? fetch)(target, {
      method: "PUT",
      headers: parsed.data.upload_headers,
      body: file.bytes as BodyInit,
      signal: controller.signal,
      redirect: "error",
    });
    if (!put.ok) throw new Error(`upload answered ${put.status}`);
  } catch {
    throw new ControlPlaneError(
      "The proof could not be uploaded. Try again, or send the claim without it.",
      0
    );
  } finally {
    clearTimeout(timer);
  }
  return parsed.data.proof_path;
}

// ---------------------------------------------------------------------------
// Claim and card checkout
// ---------------------------------------------------------------------------

export type ClaimInput = {
  subscriptionReference: string;
  clientRef: string;
  amountKobo: number;
  sentOn: string;
  senderName: string;
  payerReference?: string;
  proofPath?: string;
  claimedBy: string;
};

export async function submitClaim(
  cfg: ControlPlaneConfig,
  c: ClaimInput,
  opts: Options = {}
): Promise<{ claimId: string }> {
  const json = await signedPost(
    cfg,
    "/api/claims",
    "claim-v1",
    {
      subscription_reference: c.subscriptionReference,
      client_ref: c.clientRef,
      amount_kobo: c.amountKobo,
      sent_on: c.sentOn,
      sender_name: c.senderName,
      ...(c.payerReference ? { payer_reference: c.payerReference } : {}),
      ...(c.proofPath ? { proof_path: c.proofPath } : {}),
      claimed_by: c.claimedBy,
    },
    opts
  );
  return { claimId: String(json.claim_id ?? "") };
}

/** Starts a card payment and returns the Paystack page to send the payer to. */
export async function startCardCheckout(
  cfg: ControlPlaneConfig,
  input: { reference: string; email: string; returnUrl: string },
  opts: Options = {}
): Promise<{ authorizationUrl: string }> {
  const json = await signedPost(
    cfg,
    "/api/paystack/checkout",
    "checkout-v1",
    {
      subscription_reference: input.reference,
      payer_email: input.email,
      return_url: input.returnUrl,
    },
    opts
  );
  const raw = String(json.authorization_url ?? "");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ControlPlaneError(NOT_RESPONDING, 0);
  }
  // Only ever send a person to Paystack's own checkout.
  if (
    url.protocol !== "https:" ||
    !(url.hostname === "paystack.com" || url.hostname.endsWith(".paystack.com"))
  ) {
    throw new ControlPlaneError(NOT_RESPONDING, 0);
  }
  return { authorizationUrl: url.toString() };
}

// ---------------------------------------------------------------------------
// Receipts
// ---------------------------------------------------------------------------

const receiptsSchema = z.object({
  receipts: z.array(
    z.object({
      reference: z.string(),
      session: z.string(),
      total_kobo: z.number().int(),
      status: z.enum(["paid", "refunded"]),
      paid_at: z.string(),
      method: z.string().nullable(),
    })
  ),
});
export type PaidInvoiceSummary = z.infer<typeof receiptsSchema>["receipts"][number];

/** The invoices this school has paid, newest first. */
export async function fetchReceipts(
  cfg: ControlPlaneConfig,
  opts: Options = {}
): Promise<PaidInvoiceSummary[]> {
  const json = await signedPost(cfg, "/api/receipts", "receipts-v1", {}, opts);
  const parsed = receiptsSchema.safeParse(json);
  if (!parsed.success) throw new ControlPlaneError(NOT_RESPONDING, 0);
  return parsed.data.receipts;
}

const MAX_RECEIPT_BYTES = 2 * 1024 * 1024;

/** One receipt as PDF bytes. Refuses anything that is not a PDF or is unreasonably large. */
export async function fetchReceiptPdf(
  cfg: ControlPlaneConfig,
  reference: string,
  opts: Options = {}
): Promise<Uint8Array> {
  const res = await signedRequest(cfg, "/api/receipts/pdf", "receipts-v1", { reference }, opts);
  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as { error?: unknown } | null;
    throw new ControlPlaneError(
      res.status === 404
        ? "There is no receipt for that invoice."
        : friendly(res.status, json?.error),
      res.status
    );
  }
  const type = res.headers.get("content-type") ?? "";
  const length = Number(res.headers.get("content-length") ?? 0);
  if (!type.startsWith("application/pdf") || length > MAX_RECEIPT_BYTES) {
    throw new ControlPlaneError(NOT_RESPONDING, 0);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  const magic = String.fromCharCode(...bytes.slice(0, 5));
  if (bytes.byteLength > MAX_RECEIPT_BYTES || magic !== "%PDF-") {
    throw new ControlPlaneError(NOT_RESPONDING, 0);
  }
  return bytes;
}
