import { describe, expect, it } from "vitest";
import { PROOF_MAX_BYTES, newClaimRef, parseRenewalClaim, proofFileProblem } from "@/lib/renewal";

const TODAY = new Date("2026-10-25T12:00:00Z");
const good = {
  reference: "SUB-0A1B2C3D",
  amountText: "155,000",
  sentOn: "2026-10-24",
  senderName: "Greenfield Academy",
  payerReference: "",
};

describe("parseRenewalClaim", () => {
  it("turns what was typed into the claim, with the amount in kobo", () => {
    expect(parseRenewalClaim(good, TODAY)).toEqual({
      ok: true,
      value: {
        reference: "SUB-0A1B2C3D",
        amountKobo: 15_500_000,
        sentOn: "2026-10-24",
        senderName: "Greenfield Academy",
      },
    });
  });
  it("keeps a bank reference when there is one, trimmed", () => {
    const r = parseRenewalClaim({ ...good, payerReference: " NIP123 " }, TODAY);
    expect(r.ok && r.value.payerReference).toBe("NIP123");
  });
  it("accepts today and tomorrow's date (time zones) but not later", () => {
    expect(parseRenewalClaim({ ...good, sentOn: "2026-10-25" }, TODAY).ok).toBe(true);
    expect(parseRenewalClaim({ ...good, sentOn: "2026-10-26" }, TODAY).ok).toBe(true);
    expect(parseRenewalClaim({ ...good, sentOn: "2026-10-27" }, TODAY)).toEqual({
      ok: false,
      error: "The date you sent the payment cannot be in the future.",
    });
  });
  it("refuses a date more than 90 days back, with a way forward", () => {
    const r = parseRenewalClaim({ ...good, sentOn: "2026-07-01" }, TODAY);
    expect(r).toMatchObject({ ok: false });
    expect(!r.ok && r.error).toMatch(/more than 90 days ago/);
  });
  it("says what is wrong, one thing at a time", () => {
    const err = (over: Partial<typeof good>) => {
      const r = parseRenewalClaim({ ...good, ...over }, TODAY);
      return r.ok ? null : r.error;
    };
    expect(err({ reference: "" })).toBe("Choose which invoice you paid.");
    expect(err({ reference: "sub-0a1b2c3d" })).toBe("Choose which invoice you paid.");
    expect(err({ amountText: "" })).toMatch(/Enter the amount/);
    expect(err({ amountText: "abc" })).toMatch(/Enter the amount/);
    expect(err({ amountText: "0" })).toMatch(/Enter the amount/);
    expect(err({ amountText: "1.234" })).toMatch(/Enter the amount/);
    expect(err({ sentOn: "" })).toMatch(/Enter the date/);
    expect(err({ sentOn: "25/10/2026" })).toMatch(/Enter the date/);
    expect(err({ sentOn: "2026-13-45" })).toMatch(/Enter the date/);
    expect(err({ senderName: " " })).toMatch(/name on the account/);
    expect(err({ senderName: "x".repeat(121) })).toMatch(/name on the account/);
    expect(err({ payerReference: "x".repeat(121) })).toBe("The bank reference is too long.");
  });
});

describe("proofFileProblem", () => {
  it("accepts photos and PDFs up to 5 MB", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "application/pdf"]) {
      expect(proofFileProblem({ type, size: 1000 })).toBeNull();
    }
    expect(proofFileProblem({ type: "image/png", size: PROOF_MAX_BYTES })).toBeNull();
  });
  it("refuses other types, empty files and big ones", () => {
    expect(proofFileProblem({ type: "text/html", size: 10 })).toMatch(/JPEG, PNG or WebP/);
    expect(proofFileProblem({ type: "image/svg+xml", size: 10 })).toMatch(/JPEG, PNG or WebP/);
    expect(proofFileProblem({ type: "", size: 10 })).toMatch(/JPEG, PNG or WebP/);
    expect(proofFileProblem({ type: "image/png", size: 0 })).toBe("That file is empty.");
    expect(proofFileProblem({ type: "image/png", size: PROOF_MAX_BYTES + 1 })).toMatch(/5 MB/);
  });
});

describe("newClaimRef", () => {
  it("is long enough for the control plane, unique, and in the shape the action checks", () => {
    const a = newClaimRef();
    expect(a).toMatch(/^claim-[0-9a-f-]{36}$/);
    expect(a.length).toBeGreaterThanOrEqual(8);
    expect(newClaimRef()).not.toBe(a);
  });
});
