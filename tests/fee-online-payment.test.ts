import { afterEach, describe, expect, it, vi } from "vitest";
import { createQueueSupabaseMock, type MockResult } from "./helpers/supabaseMock";

const { getUserWithRetry } = vi.hoisted(() => ({ getUserWithRetry: vi.fn() }));
const adminState = vi.hoisted(() => ({
  queue: [] as MockResult[],
  client: null as ReturnType<typeof createQueueSupabaseMock> | null,
}));
const sendBulkEmail = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({})),
  getUserWithRetry,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => {
    adminState.client ??= createQueueSupabaseMock(adminState.queue);
    return adminState.client;
  }),
}));
vi.mock("@/lib/env.server", () => ({
  serverEnv: {
    NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    PAYSTACK_SECRET_KEY: "sk_test_1234",
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendBulkEmail }));

import { checkOnlinePaymentAllowed } from "@/lib/actions/fees";
import { STUDENT_PAYMENT_DISABLED_MESSAGE } from "@/lib/feeMessages";
import { sendGuardianReceiptCopy } from "@/lib/feeReceiptEmail";
import { createAdminClient } from "@/lib/supabase/admin";

function mockAuthenticatedAs(userId: string) {
  getUserWithRetry.mockResolvedValue({ user: { id: userId }, error: null, isTransient: false });
}

afterEach(() => {
  vi.clearAllMocks();
  adminState.queue = [];
  adminState.client = null;
});

describe("checkOnlinePaymentAllowed (student payment toggle)", () => {
  const invoice = { data: { voided_at: null, student_id: "student-1" }, error: null };

  it("blocks the student when the toggle is off", async () => {
    mockAuthenticatedAs("student-1");
    adminState.queue = [invoice, { data: { student_online_payment_enabled: false }, error: null }];

    await expect(checkOnlinePaymentAllowed("inv-1")).rejects.toThrow(
      STUDENT_PAYMENT_DISABLED_MESSAGE
    );
  });

  it("allows the student when the toggle is on", async () => {
    mockAuthenticatedAs("student-1");
    adminState.queue = [invoice, { data: { student_online_payment_enabled: true }, error: null }];

    await expect(checkOnlinePaymentAllowed("inv-1")).resolves.toBeUndefined();
  });

  it("treats a missing settings row as enabled (pre-toggle behavior)", async () => {
    mockAuthenticatedAs("student-1");
    adminState.queue = [invoice, { data: null, error: null }];

    await expect(checkOnlinePaymentAllowed("inv-1")).resolves.toBeUndefined();
  });

  it("never blocks a linked guardian, and never even reads the toggle for them", async () => {
    mockAuthenticatedAs("parent-1");
    // Queue holds only invoice + guardian link: a settings lookup would
    // exhaust it and throw.
    adminState.queue = [invoice, { data: { id: "link-1" }, error: null }];

    await expect(checkOnlinePaymentAllowed("inv-1")).resolves.toBeUndefined();
  });

  it("rejects someone who is neither the student, a guardian, nor an admin", async () => {
    mockAuthenticatedAs("stranger-1");
    adminState.queue = [
      invoice,
      { data: null, error: null },
      { data: { role: "parent", is_active: true }, error: null },
    ];

    await expect(checkOnlinePaymentAllowed("inv-1")).rejects.toThrow(
      "You can't pay an invoice that isn't yours."
    );
  });

  it("blocks a voided invoice", async () => {
    mockAuthenticatedAs("student-1");
    adminState.queue = [
      { data: { voided_at: "2026-01-01T00:00:00Z", student_id: "student-1" }, error: null },
    ];

    await expect(checkOnlinePaymentAllowed("inv-1")).rejects.toThrow(
      "This invoice has been voided and can't accept payments."
    );
  });
});

describe("sendGuardianReceiptCopy", () => {
  function guardian(id: string, email: string | null, active = true, name = "Mrs Ade") {
    return {
      parent_id: id,
      profiles: { full_name: name, is_active: active, profile_contacts: email ? { email } : null },
    };
  }

  function queueFor(links: unknown[]) {
    adminState.queue = [
      { data: links, error: null },
      { data: { full_name: "Tola Ade" }, error: null },
      {
        data: {
          total_amount_kobo: 100000,
          discount_kobo: 0,
          amount_paid_kobo: 40000,
          fee_structures: { title: "Term 1 <Tuition>" },
        },
        error: null,
      },
      { data: { name: "Bright Future" }, error: null },
    ];
  }

  it("emails only active guardians with an email on file", async () => {
    queueFor([
      guardian("p1", "mum@example.com"),
      guardian("p2", null),
      guardian("p3", "gone@example.com", false),
    ]);
    sendBulkEmail.mockResolvedValue({ sent: 1, failed: [] });

    const sent = await sendGuardianReceiptCopy({
      admin: createAdminClient(),
      studentId: "student-1",
      invoiceId: "inv-1",
      amountKobo: 40000,
    });

    expect(sent).toBe(1);
    const arg = sendBulkEmail.mock.calls[0][0];
    expect(arg.recipients).toEqual([{ email: "mum@example.com", name: "Mrs Ade" }]);
    expect(arg.text).toContain("Tola Ade");
    expect(arg.text).toContain("Remaining balance");
    // Fee titles are admin-entered text going into HTML: must be escaped.
    expect(arg.html).toContain("Term 1 &lt;Tuition&gt;");
    expect(arg.html).not.toContain("<Tuition>");
  });

  it("sends nothing when the student has no reachable guardian", async () => {
    adminState.queue = [{ data: [guardian("p2", null)], error: null }];

    const sent = await sendGuardianReceiptCopy({
      admin: createAdminClient(),
      studentId: "student-1",
      invoiceId: "inv-1",
      amountKobo: 40000,
    });

    expect(sent).toBe(0);
    expect(sendBulkEmail).not.toHaveBeenCalled();
  });

  it("never throws if email delivery fails (the payment is already recorded)", async () => {
    queueFor([guardian("p1", "mum@example.com")]);
    sendBulkEmail.mockRejectedValue(new Error("RESEND_API_KEY is not set."));

    await expect(
      sendGuardianReceiptCopy({
        admin: createAdminClient(),
        studentId: "student-1",
        invoiceId: "inv-1",
        amountKobo: 40000,
      })
    ).resolves.toBe(0);
  });
});
