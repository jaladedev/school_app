import { afterEach, describe, expect, it, vi } from "vitest";
import { createQueueSupabaseMock, type MockResult } from "./helpers/supabaseMock";

const { getUserWithRetry } = vi.hoisted(() => ({ getUserWithRetry: vi.fn() }));
const adminState = vi.hoisted(() => ({
  queue: [] as MockResult[],
  client: null as ReturnType<typeof createQueueSupabaseMock> | null,
}));
const sendTelegramMessage = vi.hoisted(() => vi.fn(async () => true));

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
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_ANON_KEY: "test-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    PAYSTACK_SECRET_KEY: "sk_test_1234",
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/telegram", () => ({ sendTelegramMessage }));

import { assertLicenseWritable } from "@/lib/actions/licenseGuard";
import { recordPayment } from "@/lib/actions/fees";
import {
  confirmPaymentClaim,
  rejectPaymentClaim,
  submitPaymentClaim,
} from "@/lib/actions/paymentClaims";
import { unwrapAction } from "@/lib/actionResult";

function signedInAs(userId: string) {
  getUserWithRetry.mockResolvedValue({ user: { id: userId }, error: null, isTransient: false });
}

afterEach(() => {
  vi.clearAllMocks();
  adminState.queue = [];
  adminState.client = null;
});

const ok = (data: unknown): MockResult => ({ data, error: null });
const adminProfile = ok({ role: "admin", is_active: true });

describe("confirmPaymentClaim", () => {
  const happyPath = (): MockResult[] => [
    adminProfile,
    ok({ id: "claim-1", invoice_id: "inv-1", amount_kobo: 2_000_000, status: "pending" }),
    ok({ voided_at: null, total_amount_kobo: 5_000_000, discount_kobo: 0, amount_paid_kobo: 0 }),
    ok([{ already_recorded: false }]),
    ok({ id: "pay-1" }),
    ok([{ id: "claim-1" }]),
    ok(null), // audit log insert
  ];

  it("records a bank_transfer payment under a claim-specific reference", async () => {
    signedInAs("admin-1");
    adminState.queue = happyPath();

    await unwrapAction(confirmPaymentClaim({ claimId: "claim-1" }));

    const rpc = adminState.client!.rpc as unknown as { mock: { calls: unknown[][] } };
    expect(rpc.mock.calls).toHaveLength(1);
    expect(rpc.mock.calls[0][0]).toBe("record_invoice_payment");
  });

  it("works when the license has lapsed, because fee payment stays open", async () => {
    signedInAs("admin-1");
    vi.mocked(assertLicenseWritable).mockRejectedValue(new Error("license expired"));
    adminState.queue = happyPath();

    await expect(unwrapAction(confirmPaymentClaim({ claimId: "claim-1" }))).resolves.not.toThrow();
    expect(assertLicenseWritable).not.toHaveBeenCalled();
  });

  it("is still refused for recordPayment's own licence check, which is unchanged", async () => {
    signedInAs("admin-1");
    vi.mocked(assertLicenseWritable).mockRejectedValue(new Error("license expired"));
    adminState.queue = [adminProfile];

    await expect(
      unwrapAction(recordPayment({ invoiceId: "inv-1", amountKobo: 1000, method: "cash" }))
    ).rejects.toThrow("license expired");
  });

  it("refuses a claim that was already dealt with", async () => {
    signedInAs("admin-1");
    adminState.queue = [
      adminProfile,
      ok({ id: "claim-1", invoice_id: "inv-1", amount_kobo: 100, status: "confirmed" }),
    ];

    await expect(unwrapAction(confirmPaymentClaim({ claimId: "claim-1" }))).rejects.toThrow(
      /already been dealt with/
    );
  });

  it("refuses someone who isn't an admin or the bursar", async () => {
    signedInAs("parent-1");
    adminState.queue = [ok({ role: "parent", is_active: true })];

    await expect(unwrapAction(confirmPaymentClaim({ claimId: "claim-1" }))).rejects.toThrow(
      "Only an admin or the bursar can handle transfer claims."
    );
  });
});

describe("rejectPaymentClaim", () => {
  it("needs a reason", async () => {
    signedInAs("admin-1");
    adminState.queue = [adminProfile];

    await expect(
      unwrapAction(rejectPaymentClaim({ claimId: "claim-1", reason: "   " }))
    ).rejects.toThrow(/reason/);
  });

  it("refuses a claim someone else already decided", async () => {
    signedInAs("admin-1");
    adminState.queue = [adminProfile, ok([])];

    await expect(
      unwrapAction(rejectPaymentClaim({ claimId: "claim-1", reason: "No credit" }))
    ).rejects.toThrow(/already been dealt with/);
  });

  it("works when the license has lapsed", async () => {
    signedInAs("admin-1");
    vi.mocked(assertLicenseWritable).mockRejectedValue(new Error("license expired"));
    adminState.queue = [adminProfile, ok([{ id: "claim-1", invoice_id: "inv-1" }]), ok(null)];

    await expect(
      unwrapAction(rejectPaymentClaim({ claimId: "claim-1", reason: "No credit" }))
    ).resolves.not.toThrow();
    expect(assertLicenseWritable).not.toHaveBeenCalled();
  });
});

describe("submitPaymentClaim", () => {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
  const input = { invoiceId: "inv-1", amountKobo: 1_000_000, sentOn: today, senderName: "Ada Obi" };
  const invoice = ok({
    id: "inv-1",
    student_id: "student-1",
    voided_at: null,
    total_amount_kobo: 5_000_000,
    discount_kobo: 0,
    amount_paid_kobo: 0,
  });
  const settings = ok({
    payment_methods: "both",
    bank_name: "GTBank",
    bank_account_name: "School",
    bank_account_number: "0123456789",
    payment_notify_chat_id: "123456",
    student_online_payment_enabled: true,
  });

  it("files a claim, tells the bursar, and credits nothing", async () => {
    signedInAs("student-1");
    adminState.queue = [
      invoice,
      settings,
      ok(null), // no open claim
      ok({ id: "claim-9" }),
      ok({ full_name: "Chidi Obi" }),
      ok(null), // audit
    ];

    const result = await unwrapAction(submitPaymentClaim(input));

    expect(result.reference).toMatch(/^INV-/);
    expect(sendTelegramMessage).toHaveBeenCalledTimes(1);
    const rpc = adminState.client!.rpc as unknown as { mock: { calls: unknown[][] } };
    expect(rpc.mock.calls).toHaveLength(0);
  });

  it("is allowed when the license has lapsed", async () => {
    signedInAs("student-1");
    vi.mocked(assertLicenseWritable).mockRejectedValue(new Error("license expired"));
    adminState.queue = [invoice, settings, ok(null), ok({ id: "claim-9" }), ok(null), ok(null)];

    await expect(unwrapAction(submitPaymentClaim(input))).resolves.toBeDefined();
  });

  it("refuses a guardian who isn't linked to the student", async () => {
    signedInAs("stranger-1");
    adminState.queue = [invoice, ok(null)];

    await expect(unwrapAction(submitPaymentClaim(input))).rejects.toThrow(
      "You can't pay an invoice that isn't yours."
    );
  });

  it("refuses when the school doesn't take transfers", async () => {
    signedInAs("student-1");
    adminState.queue = [
      invoice,
      ok({
        payment_methods: "paystack",
        bank_name: "GTBank",
        bank_account_name: "S",
        bank_account_number: "0123456789",
      }),
    ];

    await expect(unwrapAction(submitPaymentClaim(input))).rejects.toThrow(/isn't available/);
  });

  it("refuses a student when students can't pay online", async () => {
    signedInAs("student-1");
    adminState.queue = [
      invoice,
      ok({
        payment_methods: "both",
        bank_name: "GTBank",
        bank_account_name: "School",
        bank_account_number: "0123456789",
        student_online_payment_enabled: false,
      }),
    ];

    await expect(unwrapAction(submitPaymentClaim(input))).rejects.toThrow(/turned off/);
  });

  it("refuses a second claim while one is waiting", async () => {
    signedInAs("student-1");
    adminState.queue = [invoice, settings, ok({ id: "claim-1" })];

    await expect(unwrapAction(submitPaymentClaim(input))).rejects.toThrow(/already waiting/);
  });

  it("turns the unique-index race into the same friendly message", async () => {
    signedInAs("student-1");
    adminState.queue = [
      invoice,
      settings,
      ok(null),
      { data: null, error: { code: "23505", message: "dup" } },
    ];

    await expect(unwrapAction(submitPaymentClaim(input))).rejects.toThrow(/already waiting/);
  });

  it("refuses an amount over the balance", async () => {
    signedInAs("student-1");
    adminState.queue = [invoice, settings];

    await expect(
      unwrapAction(submitPaymentClaim({ ...input, amountKobo: 9_000_000 }))
    ).rejects.toThrow(/more than/);
  });
});
