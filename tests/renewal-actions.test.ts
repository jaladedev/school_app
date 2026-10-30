import { afterEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  assertCanManageFees: vi.fn(),
  getAuthenticatedUser: vi.fn(),
  writeAuditLog: vi.fn(async () => {}),
  getControlPlaneConfig: vi.fn(),
  uploadProof: vi.fn(),
  submitClaim: vi.fn(),
  startCardCheckout: vi.fn(),
  hdrs: new Map<string, string>(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (k: string) => m.hdrs.get(k.toLowerCase()) ?? null }),
}));
vi.mock("@/lib/actions/fees", () => ({ assertCanManageFees: m.assertCanManageFees }));
vi.mock("@/lib/actions/authGuards", () => ({ getAuthenticatedUser: m.getAuthenticatedUser }));
vi.mock("@/lib/audit", () => ({ writeAuditLog: m.writeAuditLog }));
vi.mock("@/lib/controlPlaneConfig", () => ({ getControlPlaneConfig: m.getControlPlaneConfig }));
vi.mock("@/lib/controlPlaneClient", async () => {
  const actual = await vi.importActual<typeof import("@/lib/controlPlaneClient")>(
    "@/lib/controlPlaneClient"
  );
  return {
    ...actual,
    uploadProof: m.uploadProof,
    submitClaim: m.submitClaim,
    startCardCheckout: m.startCardCheckout,
  };
});

import { ControlPlaneError } from "@/lib/controlPlaneClient";
import { startRenewalCardPayment, submitRenewalClaim } from "@/lib/actions/renewal";

const CFG = { baseUrl: "https://control.example.com", slug: "greenfield", privateKey: "k" };
const CLIENT_REF = "claim-123e4567-e89b-42d3-a456-426614174000";

function form(over: Record<string, string | File | null> = {}) {
  const f = new FormData();
  const fields: Record<string, string | File | null> = {
    reference: "SUB-0A1B2C3D",
    clientRef: CLIENT_REF,
    amount: "155,000",
    sentOn: new Date().toISOString().slice(0, 10),
    senderName: "Greenfield Academy",
    payerReference: "",
    ...over,
  };
  for (const [k, v] of Object.entries(fields)) if (v !== null) f.set(k, v);
  return f;
}

afterEach(() => {
  vi.clearAllMocks();
  m.hdrs.clear();
});

function ready() {
  m.assertCanManageFees.mockResolvedValue({ id: "user-1" });
  m.getAuthenticatedUser.mockResolvedValue({ id: "user-1", email: "bursar@greenfield.example" });
  m.getControlPlaneConfig.mockReturnValue(CFG);
  m.submitClaim.mockResolvedValue({ claimId: "11111111-1111-4111-8111-111111111111" });
  m.uploadProof.mockResolvedValue("proofs/greenfield/123e4567-e89b-42d3-a456-426614174000.jpg");
}

describe("submitRenewalClaim", () => {
  it("is open to a school whose licence has lapsed: paying is the one thing it must still do", async () => {
    ready();
    expect(await submitRenewalClaim(form())).toEqual({ ok: true });
    expect(m.assertCanManageFees).toHaveBeenCalledWith(expect.any(String), {
      allowWhenExpired: true,
    });
  });

  it("sends the claim signed by this school with the amount in kobo and who sent it", async () => {
    ready();
    await submitRenewalClaim(form({ payerReference: "NIP123" }));
    expect(m.submitClaim).toHaveBeenCalledWith(CFG, {
      subscriptionReference: "SUB-0A1B2C3D",
      clientRef: CLIENT_REF,
      amountKobo: 15_500_000,
      sentOn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      senderName: "Greenfield Academy",
      payerReference: "NIP123",
      proofPath: undefined,
      claimedBy: "bursar@greenfield.example",
    });
    expect(m.uploadProof).not.toHaveBeenCalled();
  });

  it("uploads the proof first and names its path in the claim", async () => {
    ready();
    const file = new File([new Uint8Array([1, 2, 3])], "receipt.jpg", { type: "image/jpeg" });
    expect(await submitRenewalClaim(form({ proof: file }))).toEqual({ ok: true });
    expect(m.uploadProof).toHaveBeenCalledWith(CFG, {
      type: "image/jpeg",
      bytes: new Uint8Array([1, 2, 3]),
    });
    expect(m.uploadProof.mock.invocationCallOrder[0]).toBeLessThan(
      m.submitClaim.mock.invocationCallOrder[0]
    );
    expect(m.submitClaim.mock.calls[0][1].proofPath).toBe(
      "proofs/greenfield/123e4567-e89b-42d3-a456-426614174000.jpg"
    );
  });

  it("treats an empty file picker as no proof", async () => {
    ready();
    await submitRenewalClaim(
      form({ proof: new File([], "", { type: "application/octet-stream" }) })
    );
    expect(m.uploadProof).not.toHaveBeenCalled();
    expect(m.submitClaim).toHaveBeenCalled();
  });

  it("refuses a proof that cannot be one, before anything is sent", async () => {
    ready();
    const html = new File(["<b>hi</b>"], "x.html", { type: "text/html" });
    expect(await submitRenewalClaim(form({ proof: html }))).toEqual({
      ok: false,
      error: "A proof can be a JPEG, PNG or WebP photo, or a PDF.",
    });
    expect(m.uploadProof).not.toHaveBeenCalled();
    expect(m.submitClaim).not.toHaveBeenCalled();
  });

  it("sends no claim when the proof cannot be uploaded, and says why", async () => {
    ready();
    m.uploadProof.mockRejectedValue(
      new ControlPlaneError("The proof could not be uploaded. Try again.", 0)
    );
    const file = new File([new Uint8Array([1])], "r.png", { type: "image/png" });
    expect(await submitRenewalClaim(form({ proof: file }))).toEqual({
      ok: false,
      error: "The proof could not be uploaded. Try again.",
    });
    expect(m.submitClaim).not.toHaveBeenCalled();
  });

  it("explains a bad form in words and sends nothing", async () => {
    ready();
    for (const [over, message] of [
      [{ reference: "" }, "Choose which invoice you paid."],
      [{ amount: "lots" }, "Enter the amount you sent"],
      [{ senderName: "" }, "Enter the name on the account"],
      [{ clientRef: "x" }, "Reload the page and try again."],
      [{ clientRef: null }, "Reload the page and try again."],
    ] as [Record<string, string | null>, string][]) {
      const r = await submitRenewalClaim(form(over));
      expect(r.ok).toBe(false);
      expect(!r.ok && r.error).toContain(message);
    }
    expect(m.submitClaim).not.toHaveBeenCalled();
    expect(m.writeAuditLog).not.toHaveBeenCalled();
  });

  it("refuses someone who is not an admin or the bursar, and a read-only support session", async () => {
    ready();
    m.assertCanManageFees.mockRejectedValue(
      new Error("Only an admin or the bursar can renew the school's licence.")
    );
    expect(await submitRenewalClaim(form())).toEqual({
      ok: false,
      error: "Only an admin or the bursar can renew the school's licence.",
    });
    expect(m.submitClaim).not.toHaveBeenCalled();
  });

  it("says so when online renewal is not set up, rather than failing mysteriously", async () => {
    ready();
    m.getControlPlaneConfig.mockReturnValue(null);
    const r = await submitRenewalClaim(form());
    expect(!r.ok && r.error).toMatch(/not set up for this school yet/);
    expect(m.submitClaim).not.toHaveBeenCalled();
  });

  it("needs an email address to send the claim from", async () => {
    ready();
    m.getAuthenticatedUser.mockResolvedValue({ id: "user-1", email: null });
    expect((await submitRenewalClaim(form())).ok).toBe(false);
    expect(m.submitClaim).not.toHaveBeenCalled();
  });

  it("passes the control plane's worded refusal through", async () => {
    ready();
    m.submitClaim.mockRejectedValue(
      new ControlPlaneError("That invoice has already been paid.", 409)
    );
    expect(await submitRenewalClaim(form())).toEqual({
      ok: false,
      error: "That invoice has already been paid.",
    });
    expect(m.writeAuditLog).not.toHaveBeenCalled();
  });

  it("hides anything unexpected behind a plain message", async () => {
    ready();
    m.submitClaim.mockRejectedValue(
      new TypeError("Cannot read properties of undefined (reading 'x')")
    );
    const r = await submitRenewalClaim(form());
    expect(r).toEqual({ ok: false, error: "Something went wrong. Please try again." });
  });

  it("records who sent the claim in this school's audit log", async () => {
    ready();
    await submitRenewalClaim(form());
    expect(m.writeAuditLog).toHaveBeenCalledWith({
      entityType: "license_claim",
      entityId: "11111111-1111-4111-8111-111111111111",
      action: "license.claim_submitted",
      actorId: "user-1",
      metadata: { invoice: "SUB-0A1B2C3D", amount_kobo: 15_500_000, with_proof: false },
    });
  });
});

describe("startRenewalCardPayment", () => {
  const authUrl = "https://checkout.paystack.com/abc";
  function cardReady() {
    ready();
    m.startCardCheckout.mockResolvedValue({ authorizationUrl: authUrl });
    m.hdrs.set("host", "school.example.com");
  }

  it("returns the Paystack page, sending the payer back to the renewal page on the host they used", async () => {
    cardReady();
    expect(await startRenewalCardPayment({ reference: "SUB-0A1B2C3D" })).toEqual({
      ok: true,
      data: { url: authUrl },
    });
    expect(m.startCardCheckout).toHaveBeenCalledWith(CFG, {
      reference: "SUB-0A1B2C3D",
      email: "bursar@greenfield.example",
      returnUrl: "https://school.example.com/dashboard/bursar/renewal?card=returned",
    });
    expect(m.assertCanManageFees).toHaveBeenCalledWith(expect.any(String), {
      allowWhenExpired: true,
    });
  });

  it("follows a proxy's forwarded host and protocol", async () => {
    cardReady();
    m.hdrs.set("x-forwarded-host", "app.greenfield.example");
    m.hdrs.set("x-forwarded-proto", "https,http");
    await startRenewalCardPayment({ reference: "SUB-0A1B2C3D" });
    expect(m.startCardCheckout.mock.calls[0][1].returnUrl).toBe(
      "https://app.greenfield.example/dashboard/bursar/renewal?card=returned"
    );
  });

  it("refuses a host that is not a host, so no odd address ends up in the return link", async () => {
    cardReady();
    m.hdrs.set("host", "evil.example/@x");
    expect((await startRenewalCardPayment({ reference: "SUB-0A1B2C3D" })).ok).toBe(false);
    m.hdrs.set("host", "");
    expect((await startRenewalCardPayment({ reference: "SUB-0A1B2C3D" })).ok).toBe(false);
    expect(m.startCardCheckout).not.toHaveBeenCalled();
  });

  it("refuses a reference that is not an invoice's, with nothing started", async () => {
    cardReady();
    for (const reference of ["", "sub-0a1b2c3d", "SUB-XYZ", "SUB-0A1B2C3D; drop"]) {
      expect((await startRenewalCardPayment({ reference })).ok).toBe(false);
    }
    expect(m.startCardCheckout).not.toHaveBeenCalled();
  });

  it("passes the control plane's wording through, and audits only a checkout that started", async () => {
    cardReady();
    m.startCardCheckout.mockRejectedValueOnce(
      new ControlPlaneError("That invoice has already been paid.", 409)
    );
    expect(await startRenewalCardPayment({ reference: "SUB-0A1B2C3D" })).toEqual({
      ok: false,
      error: "That invoice has already been paid.",
    });
    expect(m.writeAuditLog).not.toHaveBeenCalled();
    await startRenewalCardPayment({ reference: "SUB-0A1B2C3D" });
    expect(m.writeAuditLog).toHaveBeenCalledWith({
      entityType: "license_checkout",
      entityId: "user-1",
      action: "license.card_checkout_started",
      actorId: "user-1",
      metadata: { invoice: "SUB-0A1B2C3D" },
    });
  });

  it("is refused for someone who may not manage fees", async () => {
    cardReady();
    m.assertCanManageFees.mockRejectedValue(
      new Error("Only an admin or the bursar can renew the school's licence.")
    );
    expect((await startRenewalCardPayment({ reference: "SUB-0A1B2C3D" })).ok).toBe(false);
    expect(m.startCardCheckout).not.toHaveBeenCalled();
  });
});
