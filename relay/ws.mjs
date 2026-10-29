/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Room relay — a small WebSocket server
 *
 * Just enough of WebSocket (RFC 6455) for the room relay, on Node's own
 * `http` and `crypto`, so running a relay needs nothing installed: the
 * opening handshake, text frames both ways (a message split over several
 * frames is put back together), ping, pong and close. Binary messages are
 * refused (close 1003), and so is anything larger than `maxMessage`
 * (close 1009) or not masked by the client (close 1002).
 *
 * The server pings every connection every `heartbeatMs` and closes one
 * that sent nothing at all since the last ping, so a player whose network
 * vanished frees their seat in a room within two beats.
 *
 * It speaks plain `ws://`. Tilefold's tiles may only use `wss://` on the
 * default port, so a public relay sits behind something that adds TLS
 * (a reverse proxy such as Caddy or nginx, or a cloud load balancer).
 */
import { createHash } from "node:crypto";

/** The GUID every WebSocket handshake hashes with the client's key. */
const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

/** The `Sec-WebSocket-Accept` value for a client's `Sec-WebSocket-Key`. */
export function acceptKey(key) {
  return createHash("sha1")
    .update(key + GUID)
    .digest("base64");
}

/** One frame from the server: unmasked, final, with `opcode` and `payload` (a Buffer). */
export function encodeFrame(opcode, payload = Buffer.alloc(0)) {
  const n = payload.length;
  let head;
  if (n < 126) {
    head = Buffer.from([0x80 | opcode, n]);
  } else if (n < 65536) {
    head = Buffer.alloc(4);
    head[0] = 0x80 | opcode;
    head[1] = 126;
    head.writeUInt16BE(n, 2);
  } else {
    head = Buffer.alloc(10);
    head[0] = 0x80 | opcode;
    head[1] = 127;
    head.writeBigUInt64BE(BigInt(n), 2);
  }
  return Buffer.concat([head, payload]);
}

/**
 * Reads one frame from the start of `buf`: { fin, opcode, masked, payload,
 * size } (size: bytes the frame took), null while it is incomplete, or
 * { error: closeCode } when it is too large (more than `max` bytes).
 */
export function decodeFrame(buf, max) {
  if (buf.length < 2) return null;
  const fin = (buf[0] & 0x80) !== 0;
  const opcode = buf[0] & 0x0f;
  const masked = (buf[1] & 0x80) !== 0;
  let len = buf[1] & 0x7f;
  let at = 2;
  if (len === 126) {
    if (buf.length < 4) return null;
    len = buf.readUInt16BE(2);
    at = 4;
  } else if (len === 127) {
    if (buf.length < 10) return null;
    const big = buf.readBigUInt64BE(2);
    if (big > BigInt(max)) return { error: 1009 };
    len = Number(big);
    at = 10;
  }
  if (len > max) return { error: 1009 };
  const maskAt = at;
  if (masked) at += 4;
  if (buf.length < at + len) return null;
  const payload = Buffer.from(buf.subarray(at, at + len));
  if (masked) for (let i = 0; i < len; i++) payload[i] ^= buf[maskAt + (i % 4)];
  return { fin, opcode, masked, payload, size: at + len };
}

/**
 * Accepts WebSocket connections on `server` (a node:http server) at
 * `path`. For each, `onConnection(socket, request)` gets an object with
 * `send(text)`, `close(code?)`, `onMessage` and `onClose`, which it sets.
 * `allowOrigin(origin)` may refuse a page's origin (403). Returns
 * { close() } to stop the heartbeat and close every connection.
 */
export function acceptWebSockets(server, options) {
  const {
    path = "/",
    onConnection,
    allowOrigin = () => true,
    maxMessage = 64 * 1024,
    heartbeatMs = 30_000,
  } = options;
  const open = new Set();

  server.on("upgrade", (req, tcp) => {
    const url = new URL(req.url ?? "/", "http://relay");
    const key = req.headers["sec-websocket-key"];
    const refuse = (status) => {
      tcp.end(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
    };
    if (url.pathname !== path) return refuse("404 Not Found");
    if (
      String(req.headers.upgrade).toLowerCase() !== "websocket" ||
      typeof key !== "string" ||
      req.headers["sec-websocket-version"] !== "13"
    ) {
      return refuse("400 Bad Request");
    }
    if (!allowOrigin(req.headers.origin ?? null)) return refuse("403 Forbidden");
    tcp.write(
      "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n" +
        `Sec-WebSocket-Accept: ${acceptKey(key)}\r\n\r\n`,
    );
    tcp.setNoDelay(true);

    let pending = Buffer.alloc(0);
    let parts = [];
    let partsSize = 0;
    let closed = false;
    let heard = true;

    const socket = {
      onMessage: () => {},
      onClose: () => {},
      send(text) {
        if (!closed) tcp.write(encodeFrame(0x1, Buffer.from(String(text), "utf8")));
      },
      close(code = 1000) {
        if (closed) return;
        closed = true;
        const body = Buffer.alloc(2);
        body.writeUInt16BE(code, 0);
        tcp.end(encodeFrame(0x8, body));
      },
      /** Pings, or closes a connection that has been silent since the last ping. */
      beat() {
        if (closed) return;
        if (!heard) return socket.close(1001);
        heard = false;
        tcp.write(encodeFrame(0x9));
      },
    };
    open.add(socket);

    const gone = () => {
      if (!open.delete(socket)) return;
      closed = true;
      socket.onClose();
    };
    tcp.on("close", gone);
    tcp.on("error", () => tcp.destroy());

    tcp.on("data", (chunk) => {
      pending = Buffer.concat([pending, chunk]);
      for (;;) {
        const frame = decodeFrame(pending, maxMessage);
        if (frame === null) return;
        if (frame.error) return socket.close(frame.error);
        pending = pending.subarray(frame.size);
        heard = true;
        // Every frame from a browser is masked; one that isn't breaks the protocol.
        if (!frame.masked) return socket.close(1002);
        const { opcode, payload, fin } = frame;
        if (opcode === 0x8) return socket.close(1000);
        if (opcode === 0x9) {
          if (!closed) tcp.write(encodeFrame(0xa, payload));
          continue;
        }
        if (opcode === 0xa) continue;
        if (opcode === 0x2) return socket.close(1003);
        if (opcode !== 0x1 && opcode !== 0x0) return socket.close(1002);
        if (opcode === 0x0 && parts.length === 0) return socket.close(1002);
        if (opcode === 0x1 && parts.length > 0) return socket.close(1002);
        parts.push(payload);
        partsSize += payload.length;
        if (partsSize > maxMessage) return socket.close(1009);
        if (!fin) continue;
        const text = Buffer.concat(parts).toString("utf8");
        parts = [];
        partsSize = 0;
        if (!closed) socket.onMessage(text);
      }
    });

    onConnection(socket, req);
  });

  const timer = setInterval(() => {
    for (const s of open) s.beat();
  }, heartbeatMs);
  timer.unref?.();

  return {
    close() {
      clearInterval(timer);
      for (const s of open) s.close(1001);
    },
    get size() {
      return open.size;
    },
  };
}
