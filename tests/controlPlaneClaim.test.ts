import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  CLAIM_MAX_SKEW_SECONDS,
  claimMessage,
  isKeyEncoding,
  signClaim,
  timestampFresh,
  verifyClaim,
} from "@/lib/controlPlaneClaim";

// The same literal signature is asserted in the control plane's
// tests/claim-signature.test.ts. If either side changes the format, its copy of
// this test fails.
const SEED = "BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc";
const PUB = "6kpsY-KcUgq-9VB7Ey7F-ZVHdq6-vnuSQh7qaRRG0iw";
const SIG =
  "IKdfMsNp4xUYdei9bLWGxBh2Ij1TwKxpylkfVRbKW_FjJPlSj1k8MHxIuLCoYJrOCeeUWjTGDbOpqVulNH8XBQ";
const BODY = '{"amount_kobo":15000000,"client_ref":"claim-0001"}';
const TS = 1792749600;

describe("payment claim signing (shared with the control plane)", () => {
  it("signs the agreed message to the agreed signature, byte for byte", () => {
    expect(claimMessage({ slug: "greenfield", timestamp: TS, body: BODY })).toBe(
      "claim-v1\ngreenfield\n1792749600\n930cc92a2702c75f1096431e6996ed9fb8fe528d743a1143f434a19c299f2df8"
    );
    expect(signClaim({ privateKey: SEED, slug: "greenfield", timestamp: TS, body: BODY })).toBe(
      SIG
    );
  });

  it("verifies under the matching public key, and not after any change", () => {
    const good = {
      publicKeys: [PUB],
      slug: "greenfield",
      timestamp: TS,
      body: BODY,
      signature: SIG,
    };
    expect(verifyClaim(good)).toBe(true);
    expect(verifyClaim({ ...good, slug: "other" })).toBe(false);
    expect(verifyClaim({ ...good, timestamp: TS + 1 })).toBe(false);
    expect(verifyClaim({ ...good, body: BODY + " " })).toBe(false);
  });

  it("only accepts a timestamp inside the window", () => {
    const now = new Date(TS * 1000);
    expect(timestampFresh(TS + CLAIM_MAX_SKEW_SECONDS, now)).toBe(true);
    expect(timestampFresh(TS + CLAIM_MAX_SKEW_SECONDS + 1, now)).toBe(false);
  });

  it("the key generator makes a pair that signs and verifies", () => {
    const out = execFileSync("node", ["scripts/generate-claim-key.mjs"], { encoding: "utf8" });
    const privateKey = /CLAIM_SIGNING_KEY=(\S+)/.exec(out)?.[1] ?? "";
    const publicKey = out.trim().split("\n").pop() ?? "";
    expect(isKeyEncoding(privateKey) && isKeyEncoding(publicKey)).toBe(true);
    const signature = signClaim({ privateKey, slug: "a", timestamp: 1, body: "x" });
    expect(
      verifyClaim({ publicKeys: [publicKey], slug: "a", timestamp: 1, body: "x", signature })
    ).toBe(true);
    // the private key is only ever printed on the one labelled line
    expect(out.split(privateKey).length - 1).toBe(1);
  });
});

describe("purposes (shared with the control plane)", () => {
  // The same literals are asserted in the control plane's tests/claim-signature.test.ts.
  const PROOF_SIG =
    "kSZ0ensSYC0nDd0T8v8qC8MvQZbt9LffYm3mI_Nj2qmiJn0PJud-qN0XxNuwX0Ydm9HyYNnSDv2MYxwmHkxDCg";
  const CHECKOUT_SIG =
    "chp09AkA3NLKR7OeTjM-Vyv4ZeB6s-11s7ktr_w8yoGP8_4qHyXpliZ5L0_tTlNLi7jlILuBOm8op7Eh5jpHDQ";
  const base = { slug: "greenfield", timestamp: TS, body: BODY };

  it("signs each purpose to its own agreed literal signature", () => {
    expect(signClaim({ privateKey: SEED, ...base, purpose: "proof-v1" })).toBe(PROOF_SIG);
    expect(signClaim({ privateKey: SEED, ...base, purpose: "checkout-v1" })).toBe(CHECKOUT_SIG);
    expect(signClaim({ privateKey: SEED, ...base })).toBe(SIG);
  });

  it("signs the invoices and receipts purposes to the agreed literals", () => {
    expect(signClaim({ privateKey: SEED, ...base, purpose: "invoices-v1" })).toBe(
      "2Y3CY43Wyw5fPwMNiznviX80olVxg_5oBT4eiJDxj1St6rDENgZgBcl0a_JRocSGnSpLPFtxOo_lUSnnv-OlBA"
    );
    expect(signClaim({ privateKey: SEED, ...base, purpose: "receipts-v1" })).toBe(
      "dS7NEVA6muQcMufsmYJ7RUVf5Q8Iwu8V3fZ-6qG3baV8UZ7CmGbfBwIl-KJ9Ll1Qc-k2GRrY3PJMGjPRZ4qkDw"
    );
  });

  it("accepts a signature only for the purpose it was made for", () => {
    const v = (signature: string, purpose?: "claim-v1" | "proof-v1" | "checkout-v1") =>
      verifyClaim({ publicKeys: [PUB], ...base, signature, purpose });
    expect(v(PROOF_SIG, "proof-v1")).toBe(true);
    expect(v(PROOF_SIG, "checkout-v1")).toBe(false);
    expect(v(PROOF_SIG)).toBe(false);
    expect(v(CHECKOUT_SIG, "checkout-v1")).toBe(true);
    expect(v(SIG, "proof-v1")).toBe(false);
  });
});
