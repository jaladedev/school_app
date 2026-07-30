import { Resend } from "resend";

// Resend's batch endpoint caps out at 100 emails per call (each recipient
// gets their own entry in the batch — this is NOT the same as "to" holding
// an array, which would put everyone in the same visible recipient list).
const BATCH_CHUNK_SIZE = 100;

export type BulkEmailRecipient = {
  email: string;
  /** Used only for a personalized greeting in the template, never shown to other recipients. */
  name?: string;
};

export type BulkEmailResult = {
  sent: number;
  failed: { email: string; message: string }[];
};

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY is not set. Add it to your environment before sending bulk email."
    );
  }
  return new Resend(apiKey);
}

function getFromAddress(): string {
  // Falls back to Resend's shared test domain so this doesn't hard-fail in
  // an environment that hasn't verified a sending domain yet — real
  // delivery to arbitrary recipients still requires EMAIL_FROM_ADDRESS to
  // be set to an address on a domain verified in the Resend dashboard.
  return process.env.EMAIL_FROM_ADDRESS ?? "onboarding@resend.dev";
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Sends the same subject/body to a list of recipients as individual,
 * separately-addressed emails (never a shared "to" list — recipients must
 * not see each other's email addresses). Each recipient's `to` field holds
 * only their own address, sent via Resend's batch API in chunks of 100.
 *
 * Best-effort per chunk: a failed chunk is recorded in `failed` rather than
 * aborting the remaining chunks, so one bad address doesn't block delivery
 * to everyone else.
 */
export async function sendBulkEmail({
  recipients,
  subject,
  html,
  text,
}: {
  recipients: BulkEmailRecipient[];
  subject: string;
  html: string;
  text: string;
}): Promise<BulkEmailResult> {
  if (recipients.length === 0) {
    return { sent: 0, failed: [] };
  }

  const resend = getResendClient();
  const from = getFromAddress();
  const result: BulkEmailResult = { sent: 0, failed: [] };

  for (const batch of chunk(recipients, BATCH_CHUNK_SIZE)) {
    const { data, error } = await resend.batch.send(
      batch.map((r) => ({
        from,
        to: r.email,
        subject,
        html,
        text,
      })),
      { batchValidation: "permissive" }
    );

    if (error) {
      // The whole chunk was rejected outright (e.g. bad API key, from
      // address not verified) — every recipient in it counts as failed.
      for (const r of batch) {
        result.failed.push({ email: r.email, message: error.message });
      }
      continue;
    }

    const failedByIndex = new Map(data.errors.map((e) => [e.index, e.message]));
    batch.forEach((r, i) => {
      const failureMessage = failedByIndex.get(i);
      if (failureMessage) {
        result.failed.push({ email: r.email, message: failureMessage });
      } else {
        result.sent += 1;
      }
    });
  }

  return result;
}
