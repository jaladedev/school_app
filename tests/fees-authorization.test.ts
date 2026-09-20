import { afterEach, describe, expect, it, vi } from "vitest";
import { createQueueSupabaseMock, type MockResult } from "./helpers/supabaseMock";

// Same vi.hoisted pattern as tests/fees.test.ts -- see its comment for why
// a plain const/let can't be closed over by a vi.mock factory.
const { getUserWithRetry } = vi.hoisted(() => ({ getUserWithRetry: vi.fn() }));
const adminState = vi.hoisted(() => ({
  queue: [] as MockResult[],
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

// Same reasoning as tests/fees.test.ts: fees.ts reads serverEnv at import
// time, so it needs a syntactically valid stand-in even though none of
// these tests get far enough to touch Paystack.
vi.mock("@/lib/env.server", () => ({
  serverEnv: {
    NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    PAYSTACK_SECRET_KEY: "sk_test_1234",
  },
}));

vi.mock("next/cache", () => ({ revalidatePath }));

import {
  recordPayment,
  voidInvoice,
  sendFeeReminders,
  verifyPaystackPayment,
} from "@/lib/actions/fees";

function mockAuthenticatedAs(userId: string) {
  getUserWithRetry.mockResolvedValue({
    user: { id: userId },
    error: null,
    isTransient: false,
  });
}

afterEach(() => {
  vi.clearAllMocks();
  adminState.queue = [];
  adminState.client = null;
});

// Every action below gates through assertCanManageFees(["admin","teacher"])
// before touching an invoice, so the queue only ever needs to satisfy
// that gate for these rejection cases -- if it throws, nothing after it
// (the invoice/payment lookups) is ever reached.
const actions: Array<{
  name: string;
  call: () => Promise<unknown>;
  errorMessage: string;
}> = [
  {
    name: "recordPayment",
    call: () => recordPayment({ invoiceId: "inv-1", amountKobo: 1000, method: "cash" }),
    errorMessage: "Only an admin or the bursar can manage fees.",
  },
  {
    name: "voidInvoice",
    call: () => voidInvoice("inv-1", "duplicate invoice"),
    errorMessage: "Only an admin or the bursar can void an invoice.",
  },
  {
    name: "sendFeeReminders",
    call: () => sendFeeReminders(),
    errorMessage: "Only an admin or the bursar can send fee reminders.",
  },
];

describe("authorization matrix (fees)", () => {
  for (const { name, call, errorMessage } of actions) {
    it(`rejects a student calling ${name} before any DB write`, async () => {
      mockAuthenticatedAs("student-1");
      adminState.queue = [{ data: { role: "student", is_active: true }, error: null }];

      await expect(call()).rejects.toThrow(errorMessage);
    });

    it(`rejects a parent calling ${name} before any DB write`, async () => {
      mockAuthenticatedAs("parent-1");
      adminState.queue = [{ data: { role: "parent", is_active: true }, error: null }];

      await expect(call()).rejects.toThrow(errorMessage);
    });

    it(`rejects a non-bursar teacher calling ${name} before any DB write`, async () => {
      mockAuthenticatedAs("teacher-1");
      adminState.queue = [
        // assertRole(["admin","teacher"]) profile lookup -- role passes...
        { data: { role: "teacher", is_active: true }, error: null },
        // ...but assertCanManageFees's own teacher_profiles lookup fails
        // the staff_role === "bursar" check
        { data: { staff_role: "class_teacher" }, error: null },
      ];

      await expect(call()).rejects.toThrow(errorMessage);
    });

    it(`rejects a deactivated admin calling ${name} before any DB write`, async () => {
      mockAuthenticatedAs("admin-1");
      // assertRole itself rejects on is_active === false, regardless of role
      adminState.queue = [{ data: { role: "admin", is_active: false }, error: null }];

      await expect(call()).rejects.toThrow(errorMessage);
    });
  }

  it("allows a bursar teacher through the gate on voidInvoice (fails later for an unrelated reason)", async () => {
    mockAuthenticatedAs("bursar-1");
    adminState.queue = [
      { data: { role: "teacher", is_active: true }, error: null }, // assertRole
      { data: { staff_role: "bursar" }, error: null }, // assertCanManageFees
      { data: null, error: null }, // voidInvoice's own invoice lookup: not found
    ];

    // Confirms the bursar path clears assertCanManageFees entirely --
    // it fails afterward on "Invoice not found", never on authorization.
    await expect(voidInvoice("inv-missing", "test")).rejects.toThrow("Invoice not found.");
  });
});

// tests/fees.test.ts already covers the non-linked-guardian stranger
// case; this adds the one edge that leaves uncovered -- a deactivated
// admin account hitting verifyPaystackPayment's fallback
// assertRole(["admin"]) check for a non-student, non-guardian caller.
describe("verifyPaystackPayment: deactivated-account edge", () => {
  it("rejects a deactivated admin who isn't the student or a linked guardian", async () => {
    mockAuthenticatedAs("admin-1");
    adminState.queue = [
      { data: { voided_at: null, student_id: "student-1" }, error: null }, // invoice
      { data: null, error: null }, // guardian_links: no link found
      { data: { role: "admin", is_active: false }, error: null }, // assertRole(["admin"]): fails on is_active
    ];

    await expect(
      verifyPaystackPayment({ reference: "ref-999", invoiceId: "inv-1" })
    ).rejects.toThrow("You can't pay an invoice that isn't yours.");
  });
});
