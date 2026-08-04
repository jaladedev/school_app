import { Agent, fetch as undiciFetch } from "undici";

// Node's global fetch is undici under the hood, and undici does its own DNS
// resolution -- it does NOT respect the --dns-result-order Node flag (a
// widely-hit, well-documented gap: https://github.com/nodejs/undici/issues/1531,
// https://github.com/nodejs/node/issues/40537). On networks where DNS
// returns an IPv6 address for a host that isn't actually reachable over
// IPv6 (common on Windows/home networks), undici's IPv6 connection attempt
// can fail outright rather than falling back to IPv4 the way curl or a
// browser would -- surfacing as a bare "TypeError: fetch failed" with no
// useful cause. Routing through an Agent pinned to `family: 4` sidesteps
// the DNS-order/Happy-Eyeballs question entirely by never attempting IPv6
// for these calls in the first place.
//
// Pinned to `globalThis` rather than a plain module-level `const` because
// this module gets reloaded by Next.js's dev-mode Fast Refresh whenever
// anything in its dependency graph changes (which, transitively through
// every Server Action/Component using createClient(), is often). A plain
// module-level Agent gets recreated on every one of those reloads, but the
// *previous* Agent instance -- and any pooled connections still attached
// to it -- doesn't just quietly disappear; something can still hold a
// reference to it and try to dispatch a request through it after it's
// been torn down, which surfaces as `Error: The session has been
// destroyed` (visible in the terminal, but discarded down to a bare
// "fetch failed" by the time it reaches supabase-js/the browser -- see
// the try/catch below, added specifically to catch this). Storing it on
// `globalThis` under a unique key is the same fix Next.js docs recommend
// for any singleton that needs to survive Fast Refresh (most commonly
// seen for a Prisma Client instance) -- one real Agent per dev server
// process, not one per module reload. This has no effect in production,
// where there's no Fast Refresh and the module only ever loads once.
declare global {
  // eslint-disable-next-line no-var
  var __ipv4Agent: Agent | undefined;
}
const ipv4Agent = globalThis.__ipv4Agent ?? new Agent({ connect: { family: 4 } });
if (process.env.NODE_ENV !== "production") {
  globalThis.__ipv4Agent = ipv4Agent;
}

export async function ipv4Fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return (await undiciFetch(input as any, {
      ...(init as any),
      cache: "no-store",
      dispatcher: ipv4Agent,
    })) as unknown as Response;
  } catch (err) {
    // supabase-js's own error handling (auth-js's handleError) discards
    // whatever we throw here down to a bare string message before it ever
    // reaches application code -- `new AuthRetryableFetchError(message, 0)`,
    // no `cause` attached. That's why every "fetch failed" surfacing
    // elsewhere in this app has `cause: undefined` at every level: it's not
    // being swallowed by our own retry/logging code, it's gone before it
    // gets there. This is the one place upstream of that stripping where
    // the real underlying error is still attached and inspectable -- log
    // it here, then rethrow unchanged so behavior (including the existing
    // retry logic) is unaffected.
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;
    console.error(
      `[ipv4Fetch] Request to ${url} failed. Real underlying error:`,
      err,
      "\ncause:",
      (err as { cause?: unknown })?.cause
    );
    throw err;
  }
}
