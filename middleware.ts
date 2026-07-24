import { createServerClient, type CookieOptions } from "@supabase/ssr";
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

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    edgeEnv.NEXT_PUBLIC_SUPABASE_URL,
    edgeEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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
