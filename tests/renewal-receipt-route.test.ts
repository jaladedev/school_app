import { afterEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  assertCanManageFees: vi.fn(),
  getControlPlaneConfig: vi.fn(),
  fetchReceiptPdf: vi.fn(),
}));

vi.mock("@/lib/actions/fees", () => ({ assertCanManageFees: m.assertCanManageFees }));
vi.mock("@/lib/controlPlaneConfig", () => ({ getControlPlaneConfig: m.getControlPlaneConfig }));
vi.mock("@/lib/controlPlaneClient", async () => {
  const actual = await vi.importActual<typeof import("@/lib/controlPlaneClient")>(
    "@/lib/controlPlaneClient"
  );
  return { ...actual, fetchReceiptPdf: m.fetchReceiptPdf };
});

import { GET } from "@/app/dashboard/bursar/renewal/receipt/[reference]/route";
import { ControlPlaneError } from "@/lib/controlPlaneClient";

const call = (reference: string) =>
  GET(new Request("http://x"), { params: Promise.resolve({ reference }) });
const CFG = { baseUrl: "https://control.example.com", slug: "greenfield", privateKey: "k" };

afterEach(() => vi.clearAllMocks());

function ready() {
  m.assertCanManageFees.mockResolvedValue({ id: "u" });
  m.getControlPlaneConfig.mockReturnValue(CFG);
  m.fetchReceiptPdf.mockResolvedValue(new TextEncoder().encode("%PDF-1.4 x"));
}

describe("GET /dashboard/bursar/renewal/receipt/[reference]", () => {
  it("downloads the receipt as a PDF, no caching", async () => {
    ready();
    const res = await call("SUB-0A1B2C3D");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="Receipt-0A1B2C3D.pdf"'
    );
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(
      Buffer.from(await res.arrayBuffer())
        .toString()
        .startsWith("%PDF-")
    ).toBe(true);
    expect(m.fetchReceiptPdf).toHaveBeenCalledWith(CFG, "SUB-0A1B2C3D");
  });

  it("is for an admin or the bursar, works when lapsed or read-only, and says 403 otherwise", async () => {
    ready();
    await call("SUB-0A1B2C3D");
    expect(m.assertCanManageFees).toHaveBeenCalledWith(expect.any(String), {
      allowWhenExpired: true,
      allowWhenReadOnly: true,
    });
    m.assertCanManageFees.mockRejectedValue(
      new Error("Only an admin or the bursar can download receipts.")
    );
    const res = await call("SUB-0A1B2C3D");
    expect(res.status).toBe(403);
    expect(m.fetchReceiptPdf).toHaveBeenCalledTimes(1);
  });

  it("refuses a reference that is not an invoice's before asking the control plane", async () => {
    ready();
    for (const ref of ["sub-0a1b2c3d", "SUB-XYZ", "../x", "SUB-0A1B2C3D/extra", ""]) {
      expect((await call(ref)).status, ref).toBe(404);
    }
    expect(m.fetchReceiptPdf).not.toHaveBeenCalled();
  });

  it("says online renewal is not set up when it is not", async () => {
    ready();
    m.getControlPlaneConfig.mockReturnValue(null);
    expect((await call("SUB-0A1B2C3D")).status).toBe(503);
  });

  it("maps a missing receipt to 404, a billing server problem to 502, and anything else to 500", async () => {
    ready();
    m.fetchReceiptPdf.mockRejectedValueOnce(
      new ControlPlaneError("There is no receipt for that invoice.", 404)
    );
    expect((await call("SUB-0A1B2C3D")).status).toBe(404);
    m.fetchReceiptPdf.mockRejectedValueOnce(
      new ControlPlaneError("The billing server is not responding.", 0)
    );
    expect((await call("SUB-0A1B2C3D")).status).toBe(502);
    m.fetchReceiptPdf.mockRejectedValueOnce(new TypeError("secret internals"));
    const res = await call("SUB-0A1B2C3D");
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret internals");
  });
});
