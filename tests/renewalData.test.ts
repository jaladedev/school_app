import { afterEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  getControlPlaneConfig: vi.fn(),
  fetchOpenInvoices: vi.fn(),
  fetchReceipts: vi.fn(),
}));
vi.mock("@/lib/controlPlaneConfig", () => ({ getControlPlaneConfig: m.getControlPlaneConfig }));
vi.mock("@/lib/controlPlaneClient", async () => {
  const actual = await vi.importActual<typeof import("@/lib/controlPlaneClient")>(
    "@/lib/controlPlaneClient"
  );
  return { ...actual, fetchOpenInvoices: m.fetchOpenInvoices, fetchReceipts: m.fetchReceipts };
});

import { loadRenewalData } from "@/lib/renewalData";
import { ControlPlaneError } from "@/lib/controlPlaneClient";

afterEach(() => vi.clearAllMocks());
const invoices = {
  invoices: [],
  pay_to: { name: "", lines: [] },
  card_enabled: false,
  proof_enabled: false,
};

describe("loadRenewalData", () => {
  it("is not set up without a configuration, and calls nothing", async () => {
    m.getControlPlaneConfig.mockReturnValue(null);
    expect(await loadRenewalData()).toEqual({ state: "not_set_up" });
    expect(m.fetchOpenInvoices).not.toHaveBeenCalled();
  });

  it("returns the open invoices with the past payments", async () => {
    m.getControlPlaneConfig.mockReturnValue({});
    m.fetchOpenInvoices.mockResolvedValue(invoices);
    m.fetchReceipts.mockResolvedValue([{ reference: "SUB-0A1B2C3D" }]);
    expect(await loadRenewalData()).toEqual({
      state: "ready",
      data: invoices,
      receipts: [{ reference: "SUB-0A1B2C3D" }],
    });
  });

  it("still shows the invoices when past payments cannot be read", async () => {
    m.getControlPlaneConfig.mockReturnValue({});
    m.fetchOpenInvoices.mockResolvedValue(invoices);
    m.fetchReceipts.mockRejectedValue(new Error("boom"));
    expect(await loadRenewalData()).toEqual({ state: "ready", data: invoices, receipts: [] });
  });

  it("says why when the invoices cannot be read, in the control plane's words if it has them", async () => {
    m.getControlPlaneConfig.mockReturnValue({});
    m.fetchOpenInvoices.mockRejectedValueOnce(
      new ControlPlaneError("Too many attempts. Wait a minute and try again.", 429)
    );
    expect(await loadRenewalData()).toEqual({
      state: "unavailable",
      message: "Too many attempts. Wait a minute and try again.",
    });
    m.fetchOpenInvoices.mockRejectedValueOnce(new TypeError("internals"));
    expect(await loadRenewalData()).toEqual({
      state: "unavailable",
      message: "The billing server is not responding. Try again in a moment.",
    });
  });
});
