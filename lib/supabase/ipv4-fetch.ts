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
const ipv4Agent = new Agent({ connect: { family: 4 } });

export function ipv4Fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return undiciFetch(input as any, {
    ...(init as any),
    cache: "no-store",
    dispatcher: ipv4Agent,
  }) as unknown as Promise<Response>;
}
