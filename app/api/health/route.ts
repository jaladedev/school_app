import { NextResponse } from "next/server";

// Liveness and configuration check for the container's health probe and the
// deploy script. It does not query the database. It returns 503 when the
// container's environment is incomplete, so a deploy with a missing key fails
// its health check and rolls back instead of serving errors. The version is the
// image tag (the git commit) set when the image was built.
export const dynamic = "force-dynamic";

export async function GET() {
  const version = process.env.IMAGE_TAG || "dev";
  try {
    await import("@/lib/env.server");
    await import("@/lib/env.edge");
    const { readPublicConfigFromEnv } = await import("@/lib/env.client");
    readPublicConfigFromEnv();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid environment configuration.";
    return NextResponse.json({ ok: false, version, error: message }, { status: 503 });
  }
  return NextResponse.json({ ok: true, version });
}
