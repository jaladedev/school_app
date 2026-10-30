import { describe, expect, it, vi } from "vitest";
import { generateClaimKeyPair, verifyClaim } from "@/lib/controlPlaneClaim";
import {
  ControlPlaneError,
  fetchOpenInvoices,
  signedPost,
  startCardCheckout,
  submitClaim,
  uploadProof,
  type ControlPlaneConfig,
} from "@/lib/controlPlaneClient";

const keys = generateClaimKeyPair();
const cfg: ControlPlaneConfig = {
  baseUrl: "https://control.example.com",
  slug: "greenfield",
  privateKey: keys.privateKey,
};
const NOW = new Date("2026-10-25T12:00:00Z");
const json = (body: unknown, status = 200) => Response.json(body, { status });
const asFetch = (fn: unknown) => fn as typeof fetch;

type Call = [URL, RequestInit & { headers: Record<string, string> }];
const lastCall = (f: ReturnType<typeof vi.fn>) => f.mock.calls.at(-1) as unknown as Call;

describe("signedPost", () => {
  it("signs the exact body for the purpose, with the school's slug and a fresh timestamp", async () => {
    const f = vi.fn(async () => json({ ok: true, hello: 1 }));
    const out = await signedPost(
      cfg,
      "/api/invoices",
      "invoices-v1",
      {},
      { fetchImpl: asFetch(f), now: NOW }
    );
    expect(out).toEqual({ ok: true, hello: 1 });
    const [url, init] = lastCall(f);
    expect(url.toString()).toBe("https://control.example.com/api/invoices");
    expect(init.method).toBe("POST");
    expect(init.body).toBe("{}");
    expect(init.headers["x-school-slug"]).toBe("greenfield");
    const ts = Number(init.headers["x-claim-timestamp"]);
    expect(ts).toBe(Math.floor(NOW.getTime() / 1000));
    const check = (purpose: "invoices-v1" | "claim-v1") =>
      verifyClaim({
        publicKeys: [keys.publicKey],
        slug: "greenfield",
        timestamp: ts,
        body: init.body as string,
        signature: init.headers["x-claim-signature"],
        purpose,
      });
    expect(check("invoices-v1")).toBe(true);
    expect(check("claim-v1")).toBe(false);
  });

  it("never follows a redirect, so a signed request cannot be bounced elsewhere", async () => {
    const f = vi.fn(async () => json({ ok: true }));
    await signedPost(cfg, "/api/invoices", "invoices-v1", {}, { fetchImpl: asFetch(f) });
    expect(lastCall(f)[1].redirect).toBe("error");
  });

  it("explains each kind of failure in words, and never leaks a server's own detail on a 500", async () => {
    const cases: [number, unknown, string][] = [
      [401, { ok: false, error: "Request rejected." }, "did not accept this school's signing key"],
      [429, { ok: false, error: "x" }, "Too many attempts"],
      [
        409,
        { ok: false, error: "That invoice has already been paid." },
        "That invoice has already been paid.",
      ],
      [400, { ok: false, error: "amount_kobo: Too big" }, "amount_kobo: Too big"],
      [
        503,
        { ok: false, error: "Card payments are not available yet." },
        "Card payments are not available yet.",
      ],
      [500, { ok: false, error: "secret database detail" }, "not responding"],
      [404, { ok: false, error: "whatever" }, "not responding"],
    ];
    for (const [status, body, expected] of cases) {
      const f = vi.fn(async () => json(body, status));
      const err = await signedPost(cfg, "/x", "claim-v1", {}, { fetchImpl: asFetch(f) }).catch(
        (e) => e
      );
      expect(err, String(status)).toBeInstanceOf(ControlPlaneError);
      expect((err as ControlPlaneError).message, String(status)).toContain(expected);
      expect((err as ControlPlaneError).message).not.toContain("secret database detail");
      expect((err as ControlPlaneError).status).toBe(status);
    }
  });

  it("treats a network failure, a non-JSON reply and ok:false the same way", async () => {
    for (const f of [
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
      vi.fn(async () => new Response("<html>bad gateway</html>", { status: 200 })),
      vi.fn(async () => json({ ok: false })),
    ]) {
      await expect(
        signedPost(cfg, "/x", "claim-v1", {}, { fetchImpl: asFetch(f) })
      ).rejects.toThrow(/not responding/);
    }
  });

  it("insists on https, except for a control plane on this machine", async () => {
    const f = vi.fn(async () => json({ ok: true }));
    await expect(
      signedPost(
        { ...cfg, baseUrl: "http://control.example.com" },
        "/x",
        "claim-v1",
        {},
        { fetchImpl: asFetch(f) }
      )
    ).rejects.toThrow(/must be https/);
    expect(f).not.toHaveBeenCalled();
    await expect(
      signedPost(
        { ...cfg, baseUrl: "http://localhost:3000" },
        "/x",
        "claim-v1",
        {},
        { fetchImpl: asFetch(f) }
      )
    ).resolves.toBeDefined();
  });
});

const invoicesReply = {
  ok: true,
  invoices: [
    {
      reference: "SUB-0A1B2C3D",
      session: "2026/2027",
      amount_kobo: 15_500_000,
      status: "pending",
      valid_until: "2027-07-31",
      lines: [{ label: "Base fee", quantity: 1, total_kobo: 15_500_000 }],
    },
  ],
  pay_to: { name: "Acme Schools", lines: ["Bank 0123456789"] },
  card_enabled: true,
  proof_enabled: true,
};

describe("fetchOpenInvoices", () => {
  it("reads the invoices, who to pay and what is switched on", async () => {
    const f = vi.fn(async () => json(invoicesReply));
    const r = await fetchOpenInvoices(cfg, { fetchImpl: asFetch(f) });
    expect(r.invoices[0].reference).toBe("SUB-0A1B2C3D");
    expect(r.pay_to.name).toBe("Acme Schools");
    expect(r.card_enabled).toBe(true);
    expect(lastCall(f)[0].pathname).toBe("/api/invoices");
  });

  it("refuses a reply that is not the shape it expects, rather than showing half of it", async () => {
    const f = vi.fn(async () => json({ ...invoicesReply, invoices: [{ reference: "x" }] }));
    await expect(fetchOpenInvoices(cfg, { fetchImpl: asFetch(f) })).rejects.toThrow(
      /not responding/
    );
    const g = vi.fn(async () =>
      json({ ...invoicesReply, invoices: [{ ...invoicesReply.invoices[0], status: "paid" }] })
    );
    await expect(fetchOpenInvoices(cfg, { fetchImpl: asFetch(g) })).rejects.toThrow(
      /not responding/
    );
  });
});

describe("uploadProof", () => {
  const file = { type: "image/jpeg", bytes: new Uint8Array([1, 2, 3, 4, 5]) };
  const linkReply = {
    ok: true,
    proof_path: "proofs/greenfield/123e4567-e89b-42d3-a456-426614174000.jpg",
    upload_url: "https://acct.r2.cloudflarestorage.com/bucket/proofs/x?X-Amz-Signature=abc",
    upload_headers: { "content-type": "image/jpeg", "content-length": "5" },
    expires_in: 300,
  };

  it("asks for a link with the type and exact size, sends the file with the signed headers, and returns the path", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(json(linkReply))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    const path = await uploadProof(cfg, file, { fetchImpl: asFetch(f) });
    expect(path).toBe(linkReply.proof_path);
    const first = f.mock.calls[0] as unknown as Call;
    expect(first[0].pathname).toBe("/api/claims/proof");
    expect(JSON.parse(first[1].body as string)).toEqual({
      content_type: "image/jpeg",
      size_bytes: 5,
    });
    const put = f.mock.calls[1] as unknown as Call;
    expect(put[0].toString()).toBe(linkReply.upload_url);
    expect(put[1].method).toBe("PUT");
    expect(put[1].headers).toEqual(linkReply.upload_headers);
    expect(put[1].body).toBe(file.bytes);
    // The upload goes to the bucket, never carrying this school's signature headers.
    expect(put[1].headers["x-claim-signature"]).toBeUndefined();
  });

  it("says plainly when the control plane has no proof storage, and uploads nothing", async () => {
    const f = vi.fn(async () =>
      json(
        { ok: false, error: "Uploading a proof is not available yet. Send the claim without one." },
        503
      )
    );
    await expect(uploadProof(cfg, file, { fetchImpl: asFetch(f) })).rejects.toThrow(
      /not available yet/
    );
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("explains a failed upload and does not return a path", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(json(linkReply))
      .mockResolvedValueOnce(new Response("denied", { status: 403 }));
    await expect(uploadProof(cfg, file, { fetchImpl: asFetch(f) })).rejects.toThrow(
      /proof could not be uploaded/
    );
  });

  it("will not upload to a plain-http address that is not on this machine", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(json({ ...linkReply, upload_url: "http://evil.example/put" }))
      .mockResolvedValue(new Response(null, { status: 200 }));
    await expect(uploadProof(cfg, file, { fetchImpl: asFetch(f) })).rejects.toThrow(
      /must be https/
    );
    expect(f).toHaveBeenCalledTimes(1);
  });
});

describe("submitClaim", () => {
  const claim = {
    subscriptionReference: "SUB-0A1B2C3D",
    clientRef: "claim-123e4567-e89b-42d3-a456-426614174000",
    amountKobo: 15_500_000,
    sentOn: "2026-10-24",
    senderName: "Greenfield Academy",
    claimedBy: "bursar@greenfield.example",
  };
  it("sends exactly the fields the control plane expects, leaving out what is not set", async () => {
    const f = vi.fn(async () => json({ ok: true, claim_id: "abc" }, 201));
    expect(await submitClaim(cfg, claim, { fetchImpl: asFetch(f) })).toEqual({ claimId: "abc" });
    const [url, init] = lastCall(f);
    expect(url.pathname).toBe("/api/claims");
    expect(JSON.parse(init.body as string)).toEqual({
      subscription_reference: "SUB-0A1B2C3D",
      client_ref: claim.clientRef,
      amount_kobo: 15_500_000,
      sent_on: "2026-10-24",
      sender_name: "Greenfield Academy",
      claimed_by: "bursar@greenfield.example",
    });
  });
  it("adds the bank reference and proof path when there are some", async () => {
    const f = vi.fn(async () => json({ ok: true, claim_id: "abc" }, 201));
    await submitClaim(
      cfg,
      { ...claim, payerReference: "NIP123", proofPath: "proofs/greenfield/x.jpg" },
      { fetchImpl: asFetch(f) }
    );
    expect(JSON.parse(lastCall(f)[1].body as string)).toMatchObject({
      payer_reference: "NIP123",
      proof_path: "proofs/greenfield/x.jpg",
    });
  });
  it("passes the control plane's wording through, so a person sees why", async () => {
    const f = vi.fn(async () =>
      json({ ok: false, error: "That invoice has already been paid." }, 409)
    );
    await expect(submitClaim(cfg, claim, { fetchImpl: asFetch(f) })).rejects.toThrow(
      "That invoice has already been paid."
    );
  });
});

describe("startCardCheckout", () => {
  const input = {
    reference: "SUB-0A1B2C3D",
    email: "bursar@greenfield.example",
    returnUrl: "https://s.example/r",
  };
  it("returns Paystack's page, sending the invoice, email and return address but no amount", async () => {
    const f = vi.fn(async () =>
      json(
        { ok: true, authorization_url: "https://checkout.paystack.com/abc", reference: "PSK-1" },
        201
      )
    );
    expect(await startCardCheckout(cfg, input, { fetchImpl: asFetch(f) })).toEqual({
      authorizationUrl: "https://checkout.paystack.com/abc",
    });
    expect(JSON.parse(lastCall(f)[1].body as string)).toEqual({
      subscription_reference: "SUB-0A1B2C3D",
      payer_email: "bursar@greenfield.example",
      return_url: "https://s.example/r",
    });
  });
  it("will not send anyone anywhere but Paystack's own checkout", async () => {
    for (const url of [
      "https://evil.example/pay",
      "http://checkout.paystack.com/abc",
      "https://checkout.paystack.com.evil.example/x",
      "javascript:alert(1)",
      "not a url",
      "",
    ]) {
      const f = vi.fn(async () => json({ ok: true, authorization_url: url }, 201));
      await expect(startCardCheckout(cfg, input, { fetchImpl: asFetch(f) }), url).rejects.toThrow(
        /not responding/
      );
    }
  });
});
