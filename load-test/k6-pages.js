// Tests 2 and 3: server-rendered page loads as logged-in students.
//
//   k6 run -e BASE_URL=https://staging.example.com -e SUPABASE_URL=https://<ref>.supabase.co \
//          -e TOPIC_ID=<published topic id> -e SCENARIO=day|burst [-e USERS=150] [-e ARRIVAL_SECONDS=30] [-e POLL_PATH=/dashboard/student/messages] k6-pages.js
// Needs tokens.json from get-tokens.mjs in the same folder.
//
// Assumes @supabase/ssr stores the session in a cookie named sb-<ref>-auth-token as
// "base64-" + base64url(JSON), in chunks of 3180 chars (.0, .1, ...). Verify once
// against a real browser login before trusting the numbers.
import http from "k6/http";
import { check, sleep } from "k6";
import { SharedArray } from "k6/data";
import encoding from "k6/encoding";

const sessions = new SharedArray("sessions", () => JSON.parse(open("./tokens.json")));

const BASE_URL = __ENV.BASE_URL;
const SUPABASE_URL = __ENV.SUPABASE_URL;
const TOPIC_ID = __ENV.TOPIC_ID;
const USERS = Number(__ENV.USERS || 150);
const SCENARIO = __ENV.SCENARIO || "day";
// The sidebar badge polls every 30 s (lib/messagePolling.ts). Those polls are server
// actions that cannot be scripted from the repo alone, so approximate them with a cheap
// page load on this path every 30 s of virtual time (a slight overestimate).
const POLL_PATH = __ENV.POLL_PATH || "/dashboard/student/messages";
const POLL_EVERY_MS = 30000;
const ARRIVAL_SECONDS = Number(__ENV.ARRIVAL_SECONDS || 30);
let lastPoll = 0;
const REF = SUPABASE_URL.replace("https://", "").split(".")[0];
const COOKIE_NAME = `sb-${REF}-auth-token`;

const scenarios = {
  // A class-start burst: USERS people each arrive once, spread randomly over
  // the first ARRIVAL_SECONDS (default 30), load the dashboard and the
  // timetable, then stop. Not a sustained loop.
  burst: {
    executor: "per-vu-iterations",
    vus: USERS,
    iterations: 1,
    maxDuration: "5m",
  },
  day: {
    executor: "ramping-vus",
    stages: [
      { duration: "3m", target: USERS },
      { duration: "15m", target: USERS },
      { duration: "1m", target: 0 },
    ],
  },
};

export const options = {
  scenarios: { [SCENARIO]: scenarios[SCENARIO] },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<2000", "p(99)<5000"],
  },
};

function cookieHeader(session) {
  const value = "base64-" + encoding.b64encode(JSON.stringify(session), "rawurl");
  const size = 3180;
  if (value.length <= size) return `${COOKIE_NAME}=${value}`;
  const parts = [];
  for (let i = 0, n = 0; i < value.length; i += size, n++) {
    parts.push(`${COOKIE_NAME}.${n}=${value.slice(i, i + size)}`);
  }
  return parts.join("; ");
}

function load(path, headers, name) {
  const res = http.get(`${BASE_URL}${path}`, { headers, tags: { page: name } });
  check(res, { [`${name} 200`]: (r) => r.status === 200 });
  return res;
}

function pollIfDue(headers) {
  const now = Date.now();
  if (now - lastPoll >= POLL_EVERY_MS) {
    lastPoll = now;
    load(POLL_PATH, headers, "badge_poll_approx");
  }
}

export default function () {
  const session = sessions[(__VU - 1) % sessions.length];
  const headers = { Cookie: cookieHeader(session) };

  if (SCENARIO === "burst") {
    sleep(Math.random() * ARRIVAL_SECONDS);
    load("/dashboard", headers, "dashboard");
    sleep(2 + Math.random() * 3);
    load("/dashboard/student/timetable", headers, "timetable");
    return;
  }

  load("/dashboard", headers, "dashboard");

  sleep(3 + Math.random() * 7);
  pollIfDue(headers);
  load("/dashboard/student/timetable", headers, "timetable");
  sleep(5 + Math.random() * 10);
  pollIfDue(headers);
  load("/dashboard/student/notes", headers, "notes");
  sleep(5 + Math.random() * 10);
  if (TOPIC_ID) {
    load(`/dashboard/student/topics/${TOPIC_ID}`, headers, "topic");
    sleep(10 + Math.random() * 20);
    load(`/dashboard/student/topics/${TOPIC_ID}/handout`, headers, "handout");
  }
  sleep(5 + Math.random() * 10);
}