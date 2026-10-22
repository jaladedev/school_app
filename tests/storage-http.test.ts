import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Sends real requests from the AWS SDK to a local server that behaves like the
// parts of S3 that R2 supports, and checks what actually goes over the wire:
// path-style addressing, a plain body (not aws-chunked), and no flexible
// checksum headers, which are the usual way a new SDK breaks against R2.

const env = vi.hoisted(() => ({
  R2_ENDPOINT: "http://127.0.0.1:1",
  R2_BUCKET: "school-files",
  R2_ACCESS_KEY_ID: "test-key-id",
  R2_SECRET_ACCESS_KEY: "test-secret",
}));
vi.mock("@/lib/env.server", () => ({ serverEnv: env }));

import { removeObjects, uploadObject } from "@/lib/storage";

type Seen = { method: string; url: string; headers: http.IncomingHttpHeaders; body: string };
const seen: Seen[] = [];
let server: http.Server;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      seen.push({
        method: req.method ?? "",
        url: req.url ?? "",
        headers: req.headers,
        body: Buffer.concat(chunks).toString(),
      });
      if (req.method === "POST" && req.url?.includes("delete")) {
        res.setHeader("content-type", "application/xml");
        res.end(
          '<?xml version="1.0"?><DeleteResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"></DeleteResult>'
        );
        return;
      }
      res.statusCode = 200;
      res.end();
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  env.R2_ENDPOINT = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe("requests as R2 receives them", () => {
  it("uploads with a path-style URL, a plain body and no checksum headers", async () => {
    await uploadObject(
      "topic-resources",
      "t1/abc.png",
      new File(["image-bytes"], "a.png", { type: "image/png" })
    );

    const put = seen.find((r) => r.method === "PUT")!;
    expect(new URL(put.url, "http://x").pathname).toBe("/school-files/topic-resources/t1/abc.png");
    expect(put.headers["content-type"]).toBe("image/png");
    expect(put.headers["authorization"]).toContain("AWS4-HMAC-SHA256");
    expect(put.headers["authorization"]).toContain("/auto/s3/aws4_request");
    expect(put.headers["content-encoding"] ?? "").not.toContain("aws-chunked");
    expect(Object.keys(put.headers).filter((h) => /checksum/i.test(h))).toEqual([]);
    expect(put.body).toBe("image-bytes");
  });

  it("deletes by key with a batch request", async () => {
    const failed = await removeObjects("student-photos", ["s1/profile.jpg"]);

    expect(failed).toBe(0);
    const del = seen.find((r) => r.method === "POST")!;
    const deleteUrl = new URL(del.url, "http://x");
    expect(deleteUrl.pathname.replace(/\/$/, "")).toBe("/school-files");
    expect(deleteUrl.searchParams.has("delete")).toBe(true);
    expect(del.body).toContain("<Key>student-photos/s1/profile.jpg</Key>");
  });
});
