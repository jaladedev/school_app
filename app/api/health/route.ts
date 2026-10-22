import { NextResponse } from "next/server";

// Liveness and configuration check for the container's health probe and the
// deploy script. It does not query the database. It returns 503 when the
// container's environment is incomplete, so a deploy with a missing key fails
// its health check and rolls back instead of serving errors. The version is the
// image tag (the git commit) set when the image was built.
export const dynamic = "force-dynamic";

export async function GET() {
  const version = process.env.IMAGE_TAG || "dev";
  // Check every configuration module (not just the first to fail) so one
  // failed deploy lists all the missing values at once.
  const checks = [
    async () => {
      await import("@/lib/env.server");
    },
    async () => {
      await import("@/lib/env.edge");
    },
    async () => {
      const { readPublicConfigFromEnv } = await import("@/lib/env.client");
      readPublicConfigFromEnv();
    },
  ];
  const problems: string[] = [];
  for (const check of checks) {
    try {
      await check();
    } catch (err) {
      problems.push(err instanceof Error ? err.message : "Invalid environment configuration.");
    }
  }
  if (problems.length > 0) {
    return NextResponse.json({ ok: false, version, error: problems.join("\n") }, { status: 503 });
  }
  return NextResponse.json({ ok: true, version });
}
