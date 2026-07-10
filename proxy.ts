import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isDashboardRoute = request.nextUrl.pathname.startsWith("/dashboard");
  const isLoginRoute = request.nextUrl.pathname.startsWith("/login");
  const isChangePasswordRoute = request.nextUrl.pathname.startsWith("/change-password");

  if ((isDashboardRoute || isChangePasswordRoute) && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  let mustChangePassword = false;

  if (user && (isDashboardRoute || isLoginRoute || isChangePasswordRoute)) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const claims = session?.access_token ? decodeJwtPayload(session.access_token) : null;

    if (claims && "must_change_password" in claims) {
      // Fast path: the custom access token hook is active, claim read
      // straight from the JWT already in hand — no extra DB round trip.
      mustChangePassword = Boolean(claims.must_change_password);
    } else {
      // Fallback: hook not enabled yet (or an old token issued before
      // it was turned on). Same behavior as before, just not the fast path.
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