#!/usr/bin/env node
/**
 * Container smoke test.
 *
 * Starts ONE image as two different "schools" (different Supabase URL and keys,
 * each pointing at its own mock Supabase server) and checks that:
 *   1. /api/health returns 200 and reports the image tag.
 *   2. The page's injected public config carries that container's own
 *      Supabase URL, never the build placeholder or the other school's.
 *   3. Middleware talks to that container's Supabase (the mock records the
 *      request and the anon key), and nobody else's.
 *   4. A container with a missing key returns 503 from /api/health and names
 *      the key (so a bad deploy fails its health check and rolls back).
 *   5. (Docker only) the HEALTHCHECK in the Dockerfile reports healthy.
 *   6. Read-only support sessions: middleware logs every page request (even
 *      ones claiming to be prefetches), ends an expired session and clears
 *      its cookies, and leaves ordinary admins alone.
 *
 * Usage:
 *   node scripts/docker-smoke.mjs --image school-app:smoke --tag <git sha>
 *   SMOKE_LOCAL=1 node scripts/docker-smoke.mjs --tag local   # uses .next/standalone
 */
import { spawn, spawnSync } from "node:child_process";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};

const LOCAL = process.env.SMOKE_LOCAL === "1";
const IMAGE = arg("image", "school-app:smoke");
const TAG = arg("tag", "smoke");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// From inside a container the host is reachable as host.docker.internal
// (added with --add-host ...:host-gateway so it also works on Linux runners).
const MOCK_HOST = LOCAL ? "127.0.0.1" : "host.docker.internal";

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `\n      ${detail}`}`);
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "0.0.0.0", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

// A stand-in for one school's Supabase. It records what it is asked and
// rejects every auth lookup, which is all the middleware needs to redirect.
async function startMock() {
  const port = await freePort();
  const seen = [];
  // Set mock.authUser to make /auth/v1/user succeed as that user.
  const mock = { port, seen, authUser: null };
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      seen.push({
        method: req.method,
        url: req.url,
        apikey: req.headers["apikey"],
        body: Buffer.concat(chunks).toString(),
      });
      res.setHeader("content-type", "application/json");
      if (req.url?.startsWith("/auth/v1/user") && mock.authUser) {
        res.statusCode = 200;
        res.end(JSON.stringify(mock.authUser));
      } else if (req.url?.startsWith("/auth/v1/logout")) {
        res.statusCode = 204;
        res.end();
      } else if (req.url?.startsWith("/auth/v1/")) {
        res.statusCode = 401;
        res.end(JSON.stringify({ code: 401, msg: "invalid JWT" }));
      } else if (req.url?.startsWith("/rest/v1/profiles")) {
        res.end(JSON.stringify({ is_active: true, must_change_password: false }));
      } else if (req.url?.startsWith("/rest/v1/rpc/log_impersonation_event")) {
        res.statusCode = 204;
        res.end();
      } else {
        res.statusCode = 404;
        res.end("{}");
      }
    });
  });
  await new Promise((r) => server.listen(port, "0.0.0.0", r));
  mock.close = () => new Promise((r) => server.close(r));
  return mock;
}

function baseEnv(school, mock) {
  return {
    SUPABASE_URL: `http://${MOCK_HOST}:${mock.port}`,
    SUPABASE_ANON_KEY: `anon-${school}`,
    SUPABASE_SERVICE_ROLE_KEY: `service-${school}`,
    PAYSTACK_PUBLIC_KEY: `pk_test_${school}`,
    PAYSTACK_SECRET_KEY: `sk_test_${school}`,
    R2_ENDPOINT: `https://${school}.r2.example.test`,
    R2_BUCKET: `bucket-${school}`,
    R2_ACCESS_KEY_ID: `r2-key-${school}`,
    R2_SECRET_ACCESS_KEY: `r2-secret-${school}`,
    SCHOOL_SLUG: `school-${school}`,
    IMPERSONATION_SIGNING_SECRET: `impersonation-secret-for-school-${school}-0000`,
  };
}

const started = []; // for cleanup and log dumps

async function startApp(name, env) {
  const port = await freePort();
  if (LOCAL) {
    const child = spawn("node", [".next/standalone/server.js"], {
      cwd: ROOT,
      env: { ...process.env, ...env, IMAGE_TAG: TAG, PORT: String(port), HOSTNAME: "127.0.0.1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let log = "";
    child.stdout.on("data", (d) => (log += d));
    child.stderr.on("data", (d) => (log += d));
    const app = {
      name,
      base: `http://127.0.0.1:${port}`,
      logs: () => log,
      stop: () => child.kill("SIGTERM"),
    };
    started.push(app);
    return app;
  }
  const container = `school-smoke-${name}-${process.pid}`;
  const dockerArgs = [
    "run",
    "-d",
    "--name",
    container,
    "-p",
    `${port}:3000`,
    "--add-host=host.docker.internal:host-gateway",
    ...Object.entries(env).flatMap(([k, v]) => ["-e", `${k}=${v}`]),
    IMAGE,
  ];
  const run = spawnSync("docker", dockerArgs, { encoding: "utf8" });
  if (run.status !== 0) throw new Error(`docker run failed: ${run.stderr}`);
  const app = {
    name,
    container,
    base: `http://127.0.0.1:${port}`,
    logs: () => spawnSync("docker", ["logs", container], { encoding: "utf8" }).stdout,
    stop: () => spawnSync("docker", ["rm", "-f", container]),
  };
  started.push(app);
  return app;
}

async function waitForHealth(app, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${app.base}/api/health`);
      return res; // any HTTP answer means the server is up
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`${app.name} did not start within ${timeoutMs / 1000}s`);
}

// @supabase/ssr stores the session in a cookie named after the first label of
// the project hostname. For the mock that label is "host" (or "127" locally).
function fakeSessionCookie(supabaseUrl) {
  const ref = new URL(supabaseUrl).hostname.split(".")[0];
  const session = {
    access_token: "fake-access-token",
    refresh_token: "fake-refresh-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: "00000000-0000-0000-0000-000000000000", aud: "authenticated" },
  };
  const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  return `sb-${ref}-auth-token=${value}`;
}

async function checkSchool(app, mock, env, other) {
  const label = `school ${app.name}`;

  const health = await waitForHealth(app);
  const body = await health.json().catch(() => ({}));
  check(
    `${label}: /api/health is 200 with the image tag`,
    health.status === 200 && body.ok === true && body.version === TAG,
    `status ${health.status}, body ${JSON.stringify(body)}`
  );

  const home = await fetch(`${app.base}/`, { redirect: "manual" });
  const html = await home.text();
  const hasConfig = html.includes("__PUBLIC_CONFIG__");
  check(`${label}: page injects runtime public config`, hasConfig);
  check(
    `${label}: config carries this school's Supabase URL`,
    html.includes(`${MOCK_HOST}:${mock.port}`) && !html.includes(`${MOCK_HOST}:${other.port}`),
    "expected own URL and not the other school's"
  );
  check(`${label}: build placeholder is not in the page`, !html.includes("build.invalid"));

  mock.seen.length = 0;
  other.seen.length = 0;
  const dash = await fetch(`${app.base}/dashboard`, {
    redirect: "manual",
    headers: { cookie: fakeSessionCookie(env.SUPABASE_URL) },
  });
  const location = dash.headers.get("location") ?? "";
  check(
    `${label}: protected route redirects to /login`,
    dash.status >= 300 && dash.status < 400 && new URL(location, app.base).pathname === "/login",
    `status ${dash.status}, location ${location}`
  );
  const authCalls = mock.seen.filter((r) => r.url?.startsWith("/auth/v1/user"));
  check(
    `${label}: middleware called its own Supabase with its own anon key`,
    authCalls.length > 0 && authCalls.every((r) => r.apikey === env.SUPABASE_ANON_KEY),
    `requests seen: ${JSON.stringify(mock.seen)}`
  );
  check(`${label}: the other school's Supabase saw nothing`, other.seen.length === 0);
}

function authUserJson(appMetadata) {
  return {
    id: "00000000-0000-0000-0000-000000000abc",
    aud: "authenticated",
    role: "authenticated",
    email: "platform-support@support.invalid",
    app_metadata: appMetadata,
    user_metadata: {},
    created_at: "2026-10-22T00:00:00Z",
  };
}

const rpcCalls = (mock) =>
  mock.seen.filter((r) => r.url?.startsWith("/rest/v1/rpc/log_impersonation_event"));

async function checkReadOnlyMiddleware(app, mock, env) {
  const label = "read-only support session";
  const cookie = fakeSessionCookie(env.SUPABASE_URL);
  const get = (path, headers = {}) =>
    fetch(`${app.base}${path}`, { redirect: "manual", headers: { cookie, ...headers } });
  const inTenMinutes = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  // Active support session: each page view is logged, with the path.
  mock.authUser = authUserJson({
    read_only: true,
    read_only_until: inTenMinutes,
    impersonated_by: "s@x.test",
  });
  mock.seen.length = 0;
  const view = await get("/dashboard/admin/students?x=1");
  const calls = rpcCalls(mock);
  check(
    `${label}: a page view is logged with its path`,
    view.status !== 307 &&
      calls.length === 1 &&
      calls[0].body.includes('"p_event":"view"') &&
      calls[0].body.includes("/dashboard/admin/students?x=1"),
    `status ${view.status}, calls ${JSON.stringify(calls)}`
  );

  // Next.js removes the router's own signals (headers and the _rsc parameter)
  // before middleware runs, so a prefetch cannot be told apart from a
  // navigation. Nothing is skipped: a request that looks like a router
  // prefetch is logged too, so a support person cannot hide a view by
  // sending those signals.
  mock.seen.length = 0;
  await get("/dashboard/admin/students?_rsc=abc12", { rsc: "1", "next-router-prefetch": "1" });
  const routerCalls = rpcCalls(mock);
  check(
    `${label}: a request that claims to be a prefetch is still logged`,
    routerCalls.length === 1 && routerCalls[0].body.includes('"p_event":"view"'),
    JSON.stringify(routerCalls)
  );

  // Expired support session: signed out, sent to /login, cookies cleared.
  mock.authUser = authUserJson({ read_only: true, read_only_until: tenMinutesAgo });
  mock.seen.length = 0;
  const expired = await get("/dashboard");
  const location = expired.headers.get("location") ?? "";
  const setCookies = expired.headers.getSetCookie?.() ?? [];
  check(
    `${label}: an expired session is sent to /login with a reason`,
    expired.status >= 300 &&
      expired.status < 400 &&
      location.includes("/login") &&
      location.includes("reason=support-session-ended"),
    `status ${expired.status}, location ${location}`
  );
  check(
    `${label}: an expired session's cookies are cleared`,
    setCookies.some(
      (c) => c.startsWith(cookie.split("=")[0] + "=") && /max-age=0|expires=/i.test(c)
    ),
    `set-cookie: ${JSON.stringify(setCookies)}`
  );
  check(
    `${label}: the end of the session is logged`,
    rpcCalls(mock).some((r) => r.body.includes('"p_event":"ended"')),
    JSON.stringify(rpcCalls(mock))
  );
  const loginPage = await get("/login");
  check(
    `${label}: an expired session on /login does not redirect in a loop`,
    loginPage.status === 200,
    `status ${loginPage.status}, location ${loginPage.headers.get("location")}`
  );

  // A read-only user with no end time is treated as expired (fail closed).
  mock.authUser = authUserJson({ read_only: true });
  const noEnd = await get("/dashboard");
  check(
    `${label}: a read-only user with no end time is treated as expired`,
    noEnd.status >= 300 && (noEnd.headers.get("location") ?? "").includes("support-session-ended"),
    `status ${noEnd.status}`
  );

  // An ordinary admin is never logged as impersonation.
  mock.authUser = authUserJson({ provider: "email" });
  mock.seen.length = 0;
  await get("/dashboard");
  check(
    `${label}: ordinary admins are not logged as impersonation`,
    rpcCalls(mock).length === 0,
    JSON.stringify(rpcCalls(mock))
  );
  mock.authUser = null;
}

async function checkDockerHealthcheck(app) {
  const deadline = Date.now() + 120_000;
  let status = "";
  while (Date.now() < deadline) {
    const r = spawnSync(
      "docker",
      ["inspect", "--format", "{{.State.Health.Status}}", app.container],
      {
        encoding: "utf8",
      }
    );
    status = r.stdout.trim();
    if (status === "healthy" || status === "unhealthy") break;
    await new Promise((r2) => setTimeout(r2, 2000));
  }
  check(
    `school ${app.name}: Docker HEALTHCHECK reports healthy`,
    status === "healthy",
    `status: ${status}`
  );
}

async function main() {
  const mockA = await startMock();
  const mockB = await startMock();
  try {
    const envA = baseEnv("a", mockA);
    const envB = baseEnv("b", mockB);
    const a = await startApp("a", envA);
    const b = await startApp("b", envB);
    await checkSchool(a, mockA, envA, mockB);
    await checkSchool(b, mockB, envB, mockA);
    await checkReadOnlyMiddleware(a, mockA, envA);
    if (!LOCAL) await checkDockerHealthcheck(a);

    // Incomplete environment: the container must say so instead of serving.
    const {
      PAYSTACK_PUBLIC_KEY: _omit,
      R2_SECRET_ACCESS_KEY: _omitR2,
      ...incomplete
    } = baseEnv("c", mockA);
    const c = await startApp("c-incomplete", incomplete);
    const res = await waitForHealth(c);
    const text = await res.text();
    check(
      "incomplete env: /api/health is 503 and names the missing keys",
      res.status === 503 &&
        text.includes("PAYSTACK_PUBLIC_KEY") &&
        text.includes("R2_SECRET_ACCESS_KEY"),
      `status ${res.status}, body ${text.slice(0, 300)}`
    );
  } catch (err) {
    check("smoke test ran to completion", false, err instanceof Error ? err.message : String(err));
  } finally {
    if (results.some((r) => !r.ok)) {
      for (const app of started) console.log(`\n--- logs: ${app.name} ---\n${app.logs()}`);
    }
    for (const app of started) app.stop();
    await mockA.close();
    await mockB.close();
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
}

main();
