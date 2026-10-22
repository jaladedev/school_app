import { NextResponse, type NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { serverEnv } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { verifyImpersonationToken } from "@/lib/impersonation";
import { prepareSupportViewer, SUPPORT_VIEWER_EMAIL } from "@/lib/actions/supportViewer";
import { writeAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logger";

// Entry point for a read-only support session. The control plane gives a
// support person a signed link to this route (see lib/impersonation.ts). A
// valid, unused link signs the browser in as the school's read-only support
// account and sends it to the dashboard.
//
// Every refusal looks the same to the caller, so the route does not reveal
// whether a link was forged, expired, or already used; the reason is logged.
export const dynamic = "force-dynamic";

// A new response each time: a Response body can only be read once.
const refused = () =>
  NextResponse.json({ error: "This support link is invalid or has expired." }, { status: 401 });

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";

  const verified = verifyImpersonationToken(token, {
    secret: serverEnv.IMPERSONATION_SIGNING_SECRET,
    school: serverEnv.SCHOOL_SLUG,
  });
  if (!verified.ok) {
    logger.warn("impersonate: refused a support link", { reason: verified.reason });
    return refused();
  }
  const { claims } = verified;

  const admin = createAdminClient();

  // A link works once: the unique key on jti refuses a second use.
  const { error: replayError } = await admin
    .from("impersonation_links_used")
    .insert({ jti: claims.jti });
  if (replayError) {
    logger.warn("impersonate: refused a support link", {
      reason: replayError.code === "23505" ? "already_used" : "could_not_record",
      error: replayError.code === "23505" ? undefined : replayError,
    });
    return refused();
  }

  let viewer: { id: string; until: Date };
  try {
    viewer = await prepareSupportViewer(admin, claims.by);

    // Mint a session for the support account without a password: generate a
    // one-time sign-in token and redeem it here, which sets the session
    // cookies on this response. No email is sent.
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: SUPPORT_VIEWER_EMAIL,
    });
    const tokenHash = link?.properties?.hashed_token;
    if (linkError || !tokenHash) {
      throw new Error(linkError?.message ?? "No sign-in token was returned.");
    }
    const { error: otpError } = await createClient().auth.verifyOtp({
      token_hash: tokenHash,
      type: "magiclink",
    });
    if (otpError) throw new Error(otpError.message);
  } catch (error) {
    logger.error("impersonate: could not open the support session", { error });
    return NextResponse.json(
      { error: "Could not open the support session. Ask for a new link." },
      { status: 500 }
    );
  }

  await writeAuditLog({
    entityType: "impersonation",
    entityId: viewer.id,
    action: "impersonation.start",
    actorId: viewer.id,
    metadata: {
      support_user: claims.by,
      link_id: claims.jti,
      session_ends_at: viewer.until.toISOString(),
    },
  });

  redirect("/dashboard");
}
