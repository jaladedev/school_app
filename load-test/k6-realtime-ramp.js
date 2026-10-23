// Test 1: ramp held Supabase Realtime connections, mirroring live transport
// (components/TransportStatusBadge.tsx: table transport_trip_status, filter route_id).
// Messaging no longer uses Realtime (it polls), so this models parents watching a bus.
//
//   k6 run -e SUPABASE_URL=https://<ref>.supabase.co -e SUPABASE_ANON_KEY=<anon> \
//          -e ROUTE_ID=<route uuid> [-e TRIP_DATE=2026-10-20] [-e DIRECTION=morning]
//          [-e MAX_VUS=250] [-e HOLD_SECONDS=900] k6-realtime-ramp.js
// DIRECTION is 'morning' or 'afternoon' (the transport_trip_status check constraint and
// the TripDirection type).
// Needs tokens.json from get-tokens.mjs in the same folder.
import ws from "k6/ws";
import { check } from "k6";
import { SharedArray } from "k6/data";
import { Counter, Trend } from "k6/metrics";

const sessions = new SharedArray("sessions", () => JSON.parse(open("./tokens.json")));

const SUPABASE_URL = __ENV.SUPABASE_URL;
const ANON = __ENV.SUPABASE_ANON_KEY;
const MAX_VUS = Number(__ENV.MAX_VUS || 250);
const HOLD_SECONDS = Number(__ENV.HOLD_SECONDS || 900);
const ROUTE_ID = __ENV.ROUTE_ID;
const TRIP_DATE = __ENV.TRIP_DATE || new Date().toISOString().slice(0, 10);
const DIRECTION = __ENV.DIRECTION || "morning";
if (DIRECTION !== "morning" && DIRECTION !== "afternoon")
  throw new Error("DIRECTION must be morning or afternoon");
if (!ROUTE_ID) throw new Error("Set ROUTE_ID");

const joinsOk = new Counter("rt_joins_ok");
const joinsFailed = new Counter("rt_joins_failed");
const socketsRefused = new Counter("rt_sockets_refused");
const joinTime = new Trend("rt_join_ms", true);

export const options = {
  scenarios: {
    ramp: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "5m", target: MAX_VUS },
        { duration: "10m", target: MAX_VUS },
        { duration: "30s", target: 0 },
      ],
      gracefulRampDown: "30s",
      gracefulStop: "30s",
    },
  },
  thresholds: {
    rt_joins_failed: ["count<1"],
    rt_join_ms: ["p(95)<5000"],
  },
};

export default function () {
  const s = sessions[(__VU - 1) % sessions.length];
  const wsUrl = `${SUPABASE_URL.replace("https://", "wss://")}/realtime/v1/websocket?apikey=${ANON}&vsn=1.0.0`;
  const startedAt = Date.now();
  let joined = false;
  let failedCounted = false;

  const res = ws.connect(wsUrl, {}, (socket) => {
    socket.on("open", () => {
      socket.send(
        JSON.stringify({
          topic: `realtime:transport:${ROUTE_ID}:${TRIP_DATE}:${DIRECTION}`,
          event: "phx_join",
          ref: "1",
          payload: {
            config: {
              broadcast: { ack: false, self: false },
              presence: { key: "" },
              postgres_changes: [
                {
                  event: "*",
                  schema: "public",
                  table: "transport_trip_status",
                  filter: `route_id=eq.${ROUTE_ID}`,
                },
              ],
            },
            access_token: s.access_token,
          },
        })
      );
      // Phoenix heartbeat keeps the socket alive.
      socket.setInterval(() => {
        socket.send(
          JSON.stringify({ topic: "phoenix", event: "heartbeat", payload: {}, ref: "hb" })
        );
      }, 25000);
      // Hold the connection open like an idle browser tab.
      socket.setTimeout(() => socket.close(), HOLD_SECONDS * 1000);
    });

    socket.on("message", (data) => {
      const msg = JSON.parse(data);
      if (msg.event === "phx_reply" && msg.ref === "1" && !joined) {
        if (msg.payload && msg.payload.status === "ok") {
          joined = true;
          joinsOk.add(1);
          joinTime.add(Date.now() - startedAt);
        } else {
          joinsFailed.add(1);
          failedCounted = true;
          console.error(`join failed VU ${__VU}: ${data.slice(0, 200)}`);
          socket.close();
        }
      }
    });

    socket.on("error", (e) => {
      console.error(`socket error VU ${__VU}: ${e.error()}`);
    });
  });

  if (!res || res.status !== 101) {
    socketsRefused.add(1);
  }
  check(res, { "websocket upgraded": (r) => r && r.status === 101 });
  // Count a failure here only if the message handler did not already count it
  // (a refused socket, or a join that never got a reply).
  if (!joined && !failedCounted) joinsFailed.add(1);
}
