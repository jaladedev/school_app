import { NextResponse, type NextRequest } from "next/server";

// Liveness and configuration check for the container's health probe and the
// deploy script. By default it does not query the database. It returns 503
// when the container's environment is incomplete, so a deploy with a missing
// key fails its health check and rolls back instead of serving errors. The
// version is the image tag (the git commit) set when the image was built.
//
// `slug` is this school's SCHOOL_SLUG, so the control plane can catch an env
// file that belongs to a different school.
//
// `?deep=1` also checks that the database is reachable and that the
// school_license table can be read (`license` says whether a row exists; none
// is a valid state before the first push). The container health check and
// deploy script stay shallow on purpose, so a database blip never restarts or
// rolls back a container; the control plane probes with ?deep=1.
export const dynamic = "force-dynamic";

const DEEP_TIMEOUT_MS = 5000;

async function deepCheck(): Promise<{ license: boolean }> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  // school_license is not in the generated types, so the table name is cast.
  const { data, error } = await createAdminClient()
    .from("school_license" as never)
    .select("version")
    .limit(1)
    .abortSignal(AbortSignal.timeout(DEEP_TIMEOUT_MS));
  if (error) throw new Error(`Database check failed: ${error.message}`);
  return { license: Array.isArray(data) && data.length > 0 };
}

export async function GET(request: NextRequest) {
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

  const { serverEnv } = await import("@/lib/env.server");
  const slug = serverEnv.SCHOOL_SLUG;

  if (request.nextUrl.searchParams.get("deep") === "1") {
    try {
      const { license } = await deepCheck();
      return NextResponse.json({ ok: true, version, slug, license });
    } catch (err) {
      const reason =
        err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")
          ? "Database check timed out."
          : err instanceof Error
            ? err.message
            : "Database check failed.";
      return NextResponse.json({ ok: false, version, slug, error: reason }, { status: 503 });
    }
  }
  return NextResponse.json({ ok: true, version, slug });
}
