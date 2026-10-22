import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { DeleteObjectsCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

vi.mock("@/lib/env.server", () => ({
  serverEnv: {
    R2_ENDPOINT: "https://abc123.r2.cloudflarestorage.com",
    R2_BUCKET: "school-files",
    R2_ACCESS_KEY_ID: "test-key-id",
    R2_SECRET_ACCESS_KEY: "test-secret",
  },
}));

import {
  createSignedUrl,
  createSignedUrls,
  objectKey,
  removeObjects,
  resetStorageClientForTests,
  uploadObject,
} from "@/lib/storage";

// restoreAllMocks (below) removes the spy after each test, so it is recreated
// before each one.
let send: MockInstance;

beforeEach(() => {
  resetStorageClientForTests();
  send = vi.spyOn(S3Client.prototype, "send") as unknown as MockInstance;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("objectKey", () => {
  it("prefixes the folder", () => {
    expect(objectKey("topic-resources", "t1/abc.pdf")).toBe("topic-resources/t1/abc.pdf");
  });

  it.each(["", "/abs", "../x", "a/../b", "a//b"])("rejects %j", (path) => {
    expect(() => objectKey("topic-resources", path)).toThrow(/Invalid storage path/);
  });
});

describe("uploadObject", () => {
  it("puts the file under folder/path with its content type", async () => {
    send.mockResolvedValue({} as never);
    const file = new File(["hello"], "note.pdf", { type: "application/pdf" });

    await uploadObject("homework-submissions", "l1/s1/x.pdf", file);

    expect(send).toHaveBeenCalledTimes(1);
    const command = send.mock.calls[0][0] as PutObjectCommand;
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input.Bucket).toBe("school-files");
    expect(command.input.Key).toBe("homework-submissions/l1/s1/x.pdf");
    expect(command.input.ContentType).toBe("application/pdf");
    expect(Buffer.from(command.input.Body as Buffer).toString()).toBe("hello");
  });

  it("throws a readable error when R2 rejects the upload", async () => {
    send.mockRejectedValue(new Error("AccessDenied"));
    const file = new File(["x"], "a.png", { type: "image/png" });

    await expect(uploadObject("student-photos", "s1/profile.png", file)).rejects.toThrow(
      "File upload failed: AccessDenied"
    );
  });
});

describe("removeObjects", () => {
  it("deletes with folder-prefixed keys in one request", async () => {
    send.mockResolvedValue({} as never);

    const failed = await removeObjects("topic-resources", ["t1/a.png", "t1/b.png"]);

    expect(failed).toBe(0);
    const command = send.mock.calls[0][0] as DeleteObjectsCommand;
    expect(command).toBeInstanceOf(DeleteObjectsCommand);
    expect(command.input.Delete?.Objects).toEqual([
      { Key: "topic-resources/t1/a.png" },
      { Key: "topic-resources/t1/b.png" },
    ]);
  });

  it("never throws, and reports failures", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    send.mockRejectedValue(new Error("network down"));

    await expect(removeObjects("topic-resources", ["t1/a.png", "t1/b.png"])).resolves.toBe(2);
  });

  it("counts per-object errors returned by R2", async () => {
    send.mockResolvedValue({ Errors: [{ Key: "x", Code: "AccessDenied" }] } as never);
    await expect(removeObjects("topic-resources", ["t1/a.png", "t1/b.png"])).resolves.toBe(1);
  });

  it("skips invalid paths instead of sending them", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    send.mockResolvedValue({} as never);

    const failed = await removeObjects("topic-resources", ["../escape", "t1/ok.png"]);

    expect(failed).toBe(1);
    const command = send.mock.calls[0][0] as DeleteObjectsCommand;
    expect(command.input.Delete?.Objects).toEqual([{ Key: "topic-resources/t1/ok.png" }]);
  });

  it("splits more than 1000 keys into several requests", async () => {
    send.mockResolvedValue({} as never);
    const paths = Array.from({ length: 2300 }, (_, i) => `t/${i}.png`);

    await removeObjects("topic-resources", paths);

    expect(send).toHaveBeenCalledTimes(3);
  });

  it("does nothing for an empty list", async () => {
    await expect(removeObjects("topic-resources", [])).resolves.toBe(0);
    expect(send).not.toHaveBeenCalled();
  });
});

describe("signed URLs", () => {
  it("makes a presigned GET link on the account endpoint with the requested expiry", async () => {
    const url = await createSignedUrl("topic-resources", "t1/a b.pdf", 6 * 60 * 60);
    expect(url).not.toBeNull();

    const parsed = new URL(url!);
    expect(parsed.host).toBe("abc123.r2.cloudflarestorage.com");
    expect(parsed.pathname).toBe("/school-files/topic-resources/t1/a%20b.pdf");
    expect(parsed.searchParams.get("X-Amz-Expires")).toBe(String(6 * 60 * 60));
    expect(parsed.searchParams.get("X-Amz-Credential")).toContain("test-key-id/");
    expect(parsed.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
    // No flexible-checksum parameters, which R2 does not need.
    expect(url).not.toMatch(/checksum/i);
  });

  it("returns null for an invalid path instead of throwing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(createSignedUrl("topic-resources", "../x", 60)).resolves.toBeNull();
  });

  it("signs many paths, once each, leaving unsignable ones out", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const urls = await createSignedUrls(
      "student-photos",
      ["a/p.jpg", "a/p.jpg", "b/p.jpg", "../bad"],
      3600
    );

    expect([...urls.keys()].sort()).toEqual(["a/p.jpg", "b/p.jpg"]);
    expect(new URL(urls.get("b/p.jpg")!).pathname).toBe("/school-files/student-photos/b/p.jpg");
  });
});
