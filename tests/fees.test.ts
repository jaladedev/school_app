import { afterEach, describe, expect, it, vi } from "vitest";
import { createQueueSupabaseMock, type MockResult } from "./helpers/supabaseMock";

// Same vi.hoisted pattern as tests/authGuards.test.ts -- see its comment
// for why a plain const/let can't be closed over by a vi.mock factory.
const { getUserWithRetry } = vi.hoisted(() => ({ getUserWithRetry: vi.fn() }));
const adminState = vi.hoisted(() => ({
  queue: [] as MockResult[],
  // recordPayment/verifyPaystackPayment call createAdminClient() more than
  // once per invocation (once inside assertRole, again in the calling
  // function itself) -- a real Supabase createAdminClient() returns a
  // fresh client each time, but they all still read from the SAME
  // underlying request. Memoizing to one client per test (reset in
  // afterEach) keeps the queue's single position shared across every
  // createAdminClient() call in that test, instead of each call getting
  // its own counter reset to 0 and silently replaying earlier slots.
  client: null as ReturnType<typeof createQueueSupabaseMock> | null,
}));
const revalidatePath = vi.hoisted(() => vi.fn());

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

// fees.ts imports serverEnv at module load time, and the real
// lib/env.server.ts validates process.env with zod at import time too --
// without this mock, simply importing lib/actions/fees.ts in a test
// throws "Invalid server environment configuration" outside a real
// deployment. PAYSTACK_SECRET_KEY only actually gets read on the
// non-idempotent path (after the reference lookup misses), so most tests
// here never exercise it, but it still needs to exist as *something*
// syntactically valid for the module to load.
vi.mock("@/lib/env.server", () => ({
  serverEnv: {
    NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    PAYSTACK_SECRET_KEY: "sk_test_1234",
  },
}));

// revalidatePath needs a request-scoped Next.js store that doesn't exist
// under plain Vitest -- calling the real one throws outside a Next
// request. It has no return value any of these functions inspect, so a
// no-op stub is enough.
vi.mock("next/cache", () => ({ revalidatePath }));

import { recordPayment, verifyPaystackPayment } from "@/lib/actions/fees";

function mockAuthenticatedAs(userId: string) {
  getUserWithRetry.mockResolvedValue({
    user: { id: userId },
    error: null,
    isTransient: false,
  });
}

const fetchMock = vi.fn();

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  adminState.queue = [];
  adminState.client = null;
});

describe("recordPayment", () => {
  it("rejects a payment that exceeds the remaining balance", async () => {
    mockAuthenticatedAs("admin-1");
    adminState.queue = [
      // assertCanManageFees -> assertRole(["admin","teacher"], ...) profile lookup
      { data: { role: "admin", is_active: true }, error: null },
      // recordPayment's own invoice lookup: total 10,000 - discount 0 - paid
      // 8,000 = 2,000 kobo still owed
      { data: { voided_at: null, total_amount_kobo: 10000, discount_kobo: 0, amount_paid_kobo: 8000 }, error: null },
    ];

    await expect(
      recordPayment({ invoiceId: "inv-1", amountKobo: 5000, method: "cash" })
    ).rejects.toThrow(/more than the/);
  });

  it("allows a payment exactly equal to the remaining balance (boundary, not just under)", async () => {
    mockAuthenticatedAs("admin-1");
    adminState.queue = [
      { data: { role: "admin", is_active: true }, error: null },
      { data: { voided_at: null, total_amount_kobo: 10000, discount_kobo: 0, amount_paid_kobo: 8000 }, error: null },
      { data: [{ already_recorded: false }], error: null }, // record_invoice_payment RPC
    ];

    await expect(
      recordPayment({ invoiceId: "inv-1", amountKobo: 2000, method: "cash" })
    ).resolves.toBeUndefined();
  });

  it("rejects a zero or negative amount before ever touching the invoice", async () => {
    mockAuthenticatedAs("admin-1");
    adminState.queue = [{ data: { role: "admin", is_active: true }, error: null }];

    await expect(
      recordPayment({ invoiceId: "inv-1", amountKobo: 0, method: "cash" })
    ).rejects.toThrow("Payment amount must be greater than zero.");
  });

  it("blocks a payment on a voided invoice", async () => {
    mockAuthenticatedAs("admin-1");
    adminState.queue = [
      { data: { role: "admin", is_active: true }, error: null },
      {
        data: {
          voided_at: "2026-01-01T00:00:00Z",
          total_amount_kobo: 10000,
          discount_kobo: 0,
          amount_paid_kobo: 0,
        },
        error: null,
      },
    ];

    await expect(
      recordPayment({ invoiceId: "inv-1", amountKobo: 1000, method: "cash" })
    ).rejects.toThrow("This invoice has been voided and can't accept payments.");
  });
});

describe("verifyPaystackPayment", () => {
  it("returns { alreadyRecorded: true } for a duplicate reference without calling Paystack", async () => {
    mockAuthenticatedAs("student-1");
    vi.stubGlobal("fetch", fetchMock);
    adminState.queue = [
      // invoice lookup -- requester IS the student on the invoice, so the
      // guardian_links check is skipped entirely
      { data: { voided_at: null, student_id: "student-1" }, error: null },
      // payments lookup by reference: a row already exists
      { data: { id: "existing-payment-1" }, error: null },
    ];

    await expect(
      verifyPaystackPayment({ reference: "ref-123", invoiceId: "inv-1" })
    ).resolves.toEqual({ alreadyRecorded: true });

    // The whole point of the idempotency check is to short-circuit before
    // ever re-verifying with Paystack or crediting the invoice again.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blocks verification on a voided invoice", async () => {
    mockAuthenticatedAs("student-1");
    adminState.queue = [{ data: { voided_at: "2026-01-01T00:00:00Z", student_id: "student-1" }, error: null }];

    await expect(verifyPaystackPayment({ reference: "ref-456", invoiceId: "inv-1" })).rejects.toThrow(
      "This invoice has been voided and can't accept payments."
    );
  });

  it("rejects verification from someone who is neither the student, a linked guardian, nor an admin", async () => {
    mockAuthenticatedAs("stranger-1");
    adminState.queue = [
      { data: { voided_at: null, student_id: "student-1" }, error: null }, // invoice
      { data: null, error: null }, // guardian_links: no link found
      { data: { role: "parent", is_active: true }, error: null }, // assertRole(["admin"]) profile lookup
    ];

    await expect(verifyPaystackPayment({ reference: "ref-789", invoiceId: "inv-1" })).rejects.toThrow(
      "You can't pay an invoice that isn't yours."
    );
  });
});