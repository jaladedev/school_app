import {
  DeleteObjectsCommand,
  PutObjectCommand,
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageFolder } from "@/lib/storageBuckets";

// The only code that talks to file storage. Files live in this school's own
// Cloudflare R2 bucket (one private bucket, one folder per kind of file),
// reached through R2's S3-compatible API. The database stores the object path
// *inside* the folder (for example "<topicId>/<uuid>.pdf"); this module adds
// the folder prefix, so the stored values are the same ones Supabase Storage
// used and no data migration of the database is needed.
//
// R2 has no per-bucket size or file-type limits, so callers must check both
// before calling uploadObject (every upload action already does).

const DELETE_BATCH_SIZE = 1000; // S3 DeleteObjects limit

let storagePromise: Promise<{ client: S3Client; bucket: string }> | null = null;

// The environment is read on first use, not when this module is imported, so
// importing a server action does not require storage settings to be present
// (the container's start-up check in /api/health already validates them).
// Concurrent first calls share one initialisation.
function getStorage(): Promise<{ client: S3Client; bucket: string }> {
  storagePromise ??= (async () => {
    const { serverEnv } = await import("@/lib/env.server");
    const client = new S3Client({
      region: "auto",
      endpoint: serverEnv.R2_ENDPOINT,
      forcePathStyle: true,
      credentials: {
        accessKeyId: serverEnv.R2_ACCESS_KEY_ID,
        secretAccessKey: serverEnv.R2_SECRET_ACCESS_KEY,
      },
      // The SDK adds CRC32 checksums to every request by default; R2 does not
      // need them, and they end up inside presigned URLs. Only send them when
      // an operation requires one.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
    return { client, bucket: serverEnv.R2_BUCKET };
  })().catch((error) => {
    storagePromise = null; // let the next call try again
    throw error;
  });
  return storagePromise;
}

/** Test hook: drop the cached client so the next call rebuilds it. */
export function resetStorageClientForTests() {
  storagePromise = null;
}

/** The full object key for a path stored in the database. */
export function objectKey(folder: StorageFolder, path: string): string {
  if (
    !path ||
    path.startsWith("/") ||
    path.split("/").some((part) => part === ".." || part === "")
  ) {
    throw new Error(`Invalid storage path: ${JSON.stringify(path)}`);
  }
  return `${folder}/${path}`;
}

/** Uploads a file. Throws if the upload fails. Overwrites an existing object. */
export async function uploadObject(
  folder: StorageFolder,
  path: string,
  file: File,
  contentType: string = file.type
): Promise<void> {
  const body = Buffer.from(await file.arrayBuffer());
  try {
    const { client, bucket } = await getStorage();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey(folder, path),
        Body: body,
        ContentType: contentType,
      })
    );
  } catch (error) {
    throw new Error(
      `File upload failed: ${error instanceof Error ? error.message : "unknown storage error"}`
    );
  }
}

/**
 * Deletes objects. Best effort and never throws: every caller treats a failed
 * delete as cleanup that must not fail the action (an orphaned object costs
 * little; a failed action loses the user's work). Returns how many deletes
 * failed so callers that care can log it.
 */
export async function removeObjects(folder: StorageFolder, paths: string[]): Promise<number> {
  const keys: string[] = [];
  for (const path of paths) {
    try {
      keys.push(objectKey(folder, path));
    } catch (error) {
      console.error("[storage] skipping delete of an invalid path:", error);
    }
  }
  let failed = paths.length - keys.length;

  for (let i = 0; i < keys.length; i += DELETE_BATCH_SIZE) {
    const batch = keys.slice(i, i + DELETE_BATCH_SIZE);
    try {
      const { client, bucket } = await getStorage();
      const result = await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
        })
      );
      failed += result.Errors?.length ?? 0;
    } catch (error) {
      failed += batch.length;
      console.error("[storage] delete failed:", error);
    }
  }
  return failed;
}

/**
 * A time-limited link for reading one private object, or null if it could not
 * be made (bad path, bad configuration). Signing is local, so this does not
 * check that the object exists.
 */
export async function createSignedUrl(
  folder: StorageFolder,
  path: string,
  expiresInSeconds: number
): Promise<string | null> {
  try {
    const { client, bucket } = await getStorage();
    return await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: objectKey(folder, path) }),
      { expiresIn: expiresInSeconds }
    );
  } catch (error) {
    console.error("[storage] could not sign a URL:", error);
    return null;
  }
}

/** Signs many paths at once. Paths that cannot be signed are left out of the map. */
export async function createSignedUrls(
  folder: StorageFolder,
  paths: string[],
  expiresInSeconds: number
): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  await Promise.all(
    [...new Set(paths)].map(async (path) => {
      const url = await createSignedUrl(folder, path, expiresInSeconds);
      if (url) urls.set(path, url);
    })
  );
  return urls;
}
