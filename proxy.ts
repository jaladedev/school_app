import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { edgeEnv } from "@/lib/env.edge";

// Decodes a JWT payload without verifying the signature. That's fine
// here — this claim only gates a UI redirect (whether to show the
// change-password screen), it isn't used to authorize any data access.
// Actual data access is still governed by RLS using the verified,
// signature-checked session on the server/client that runs the query.
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    edgeEnv.NEXT_PUBLIC_SUPABASE_URL,
    edgeEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      // Next.js patches the global `fetch` to route through its Data Cache
      // layer. supabase-js's internal auth calls (getUser(), etc.) can fail
      // against that patched fetch when run inside proxy.ts -- surfacing as
      // a bare "fetch failed" with no useful cause, even though the exact
      // same request succeeds from a plain Node script or from the browser.
      // Passing an explicit fetch here that forces `cache: "no-store"`
      // opts these specific calls out of Next's caching layer, which is
      // the documented workaround for this failure mode.
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) =>
          fetch(input, { ...init, cache: "no-store" }),
      },
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  // Same reasoning as getCurrentProfile() in lib/supabase/server.ts: a cold
  // connection right after the dev server starts (or after any idle
  // period) is the most common cause of a transient failure here, so one
  // short retry resolves that case silently instead of needlessly falling
  // through to the "couldn't verify, but not forcing a logout" path below.
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"] = null;
  let getUserError: Awaited<ReturnType<typeof supabase.auth.getUser>>["error"] = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await supabase.auth.getUser();
    user = result.data.user;
    getUserError = result.error;
    if (!getUserError || !isAuthRetryableFetchError(getUserError)) break;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  // getUser() can fail two very different ways: the session is actually
  // invalid/expired (a real "not logged in"), or the request to Supabase's
  // Auth server itself failed (network blip, DNS hiccup, etc). Only the
  // first should force a logout -- treating a transient network failure
  // the same way means one flaky request kicks a legitimately signed-in
  // person back to /login. On a retryable failure we fall through and let
  // the request continue as if this check hadn't run; actual data access
  // downstream is still gated by RLS using the real, verified session, so
  // this isn't loosening authorization, just not letting a network blip
  // masquerade as a logout.
  const authCheckFailedTransiently = getUserError
    ? isAuthRetryableFetchError(getUserError)
    : false;

  const isDashboardRoute = request.nextUrl.pathname.startsWith("/dashboard");
  const isLoginRoute = request.nextUrl.pathname.startsWith("/login");
  const isChangePasswordRoute = request.nextUrl.pathname.startsWith("/change-password");

  if ((isDashboardRoute || isChangePasswordRoute) && !user && !authCheckFailedTransiently) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (authCheckFailedTransiently) {
    return response;
  }

  let mustChangePassword = false;

  if (user && (isDashboardRoute || isLoginRoute || isChangePasswordRoute)) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const claims = session?.access_token ? decodeJwtPayload(session.access_token) : null;

    if (claims && "must_change_password" in claims) {
      mustChangePassword = Boolean(claims.must_change_password);
    } else {
      const { data: profile } = await supabase
        .from("profiles")
        .select("must_change_password")
        .eq("id", user.id)
        .single();
      mustChangePassword = profile?.must_change_password ?? false;
    }
  }

  if (isDashboardRoute && mustChangePassword) {
    return NextResponse.redirect(new URL("/change-password", request.url));
  }

  if (isLoginRoute && user) {
    return NextResponse.redirect(
      new URL(mustChangePassword ? "/change-password" : "/dashboard", request.url)
    );
  }

  if (isChangePasswordRoute && user && !mustChangePassword) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/change-password"],
};
