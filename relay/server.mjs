#!/usr/bin/env node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Room relay — the server
 *
 * Runs a room relay: the rooms (rooms.mjs) on a WebSocket (ws.mjs), with
 * GET /health answering how many rooms and connections there are, and a
 * sweep every few minutes that expires rooms unused for a day. Each step
 * is written to standard output as one JSON line (time, action and a few
 * plain details, never names, codes or messages), which is the relay's
 * activity log.
 *
 *   node relay/server.mjs [--port 8787] [--host 127.0.0.1] [--path /rooms]
 *
 * PORT, HOST, RELAY_PATH and ALLOW_ORIGINS (a comma-separated list of page
 * origins; every origin by default) may be set in the environment
 * instead. It listens on this machine only unless HOST says otherwise; put
 * it behind a proxy that adds TLS to reach it as wss:// from tiles.
 */
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { createRooms, MAX_FRAME } from "./rooms.mjs";
import { acceptWebSockets } from "./ws.mjs";

/** How often unused rooms are looked for. */
export const SWEEP_EVERY_MS = 10 * 60 * 1000;

/** One activity line as JSON text. */
export const logLine = (action, details = {}, now = Date.now) =>
  JSON.stringify({ ts: new Date(now()).toISOString(), action, ...details });

/**
 * A relay listening on `port` (0: any free one). Options: host, path,
 * allowOrigin(origin), log(action, details), rooms (createRooms options),
 * heartbeatMs. Resolves to { url, port, rooms, close() }.
 */
export async function startRelay(options = {}) {
  const {
    port = 8787,
    host = "127.0.0.1",
    path = "/rooms",
    allowOrigin = () => true,
    log = (action, details) => process.stdout.write(`${logLine(action, details)}\n`),
    heartbeatMs,
  } = options;
  const rooms = createRooms({ log, ...options.rooms });
  let next = 0;

  const server = createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true, ...rooms.stats() }));
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("This is a Tilefold room relay. Connect with a WebSocket.\n");
  });

  const sockets = acceptWebSockets(server, {
    path,
    allowOrigin,
    // Room-sized frames up to twice the limit reach the rooms, which answer too-large.
    maxMessage: MAX_FRAME * 2,
    ...(heartbeatMs ? { heartbeatMs } : {}),
    onConnection(socket, req) {
      const id = `c${(++next).toString(36)}`;
      // What `authorize` may check: the page's origin and a `token` in the address, if any.
      const token = new URL(req.url ?? "/", "http://relay").searchParams.get("token");
      rooms.connect(id, (text) => socket.send(text), { origin: req.headers.origin ?? null, token });
      socket.onMessage = (text) => rooms.receive(id, text);
      socket.onClose = () => rooms.disconnect(id);
    },
  });

  const sweeper = setInterval(() => rooms.sweep(), SWEEP_EVERY_MS);
  sweeper.unref?.();

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
  const actual = server.address().port;
  log("listening", { port: actual, path });

  return {
    url: `ws://${host}:${actual}${path}`,
    port: actual,
    rooms,
    close: () =>
      new Promise((resolve) => {
        clearInterval(sweeper);
        sockets.close();
        server.close(() => resolve());
        server.closeAllConnections?.();
      }),
  };
}

/** The options the command line and environment ask for. */
export function optionsFrom(argv, env) {
  const flag = (name) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const origins = (env.ALLOW_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  return {
    port: Number(flag("port") ?? env.PORT ?? 8787),
    host: flag("host") ?? env.HOST ?? "127.0.0.1",
    path: flag("path") ?? env.RELAY_PATH ?? "/rooms",
    allowOrigin: origins.length ? (origin) => origins.includes(origin) : () => true,
  };
}

// Run as a command: start, and stop cleanly on Ctrl+C or a service stop.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const relay = await startRelay(optionsFrom(process.argv.slice(2), process.env));
  const stop = async () => {
    process.stdout.write(`${logLine("stopping")}\n`);
    await relay.close();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
