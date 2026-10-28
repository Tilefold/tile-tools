/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Gomoku — the room relay's client
 *
 * One WebSocket to a room relay: a small server that knows nothing about
 * Gomoku. It makes rooms with a code, lets a few people into each, and
 * passes what one of them sends to the others. Any relay that speaks this
 * protocol works, so a tile like this one can use its own server.
 *
 * Protocol (JSON text frames, version 1):
 *
 *   to the relay                        from the relay
 *   { op: "create", app, size, name }   { op: "created", room, you }
 *   { op: "join", room, app, name }     { op: "joined", room, you, members }
 *   { op: "send", data }                { op: "message", from, data }
 *   { op: "leave" }                     { op: "member-joined", member }
 *   { op: "ping" }                      { op: "member-left", member }
 *                                       { op: "pong" }
 *                                       { op: "error", code }
 *
 * `you` and member ids name connections, not people: a player who
 * reconnects gets a new one. `members` lists the others in the room as
 * `{ id, name }`. Error codes: no-room, room-full, wrong-app, bad-request,
 * too-large, too-fast, unauthorized.
 *
 * The client reconnects by itself after a dropped connection, waiting a
 * little longer each time (1, 2, 4, 8, then every 15 seconds), and pings
 * every minute so an idle connection isn't closed by the relay. What to do
 * after a reconnect (joining the room again) is the caller's: it hears
 * `open` each time.
 */

/** Waits between reconnects, in milliseconds; the last one repeats. */
export const BACKOFF = [1000, 2000, 4000, 8000, 15000];

/** How often an open connection pings, in milliseconds. */
export const PING_EVERY = 60_000;

/** Failed tries in a row after which the caller hears `offline`. */
export const OFFLINE_AFTER = 3;

/**
 * A relay connection. `onEvent` hears `{ type: "open" }`, `{ type: "close" }`,
 * `{ type: "offline" }` (several tries in a row failed; it keeps trying) and
 * `{ type: "message", message }` for each frame from the relay.
 *
 * @param {{ url: string, WebSocket: any, onEvent: (e: any) => void,
 *   timers?: { setTimeout: Function, clearTimeout: Function, setInterval: Function, clearInterval: Function } }} options
 */
export function createRelay({ url, WebSocket, onEvent, timers = globalThis }) {
  /** The live socket, or null between tries. */
  let socket = null;
  /** Whether the caller wants a connection (false after close()). */
  let wanted = false;
  /** Failed tries since the last open. */
  let failures = 0;
  let retry = null;
  let ping = null;

  const emit = (e) => {
    try {
      onEvent(e);
    } catch {
      // A failing listener must not break the connection.
    }
  };

  const stopTimers = () => {
    if (retry !== null) timers.clearTimeout(retry);
    if (ping !== null) timers.clearInterval(ping);
    retry = null;
    ping = null;
  };

  /** Opens a socket now, unless one is open or opening. */
  function dial() {
    if (!wanted || socket) return;
    let ws;
    try {
      ws = new WebSocket(url);
    } catch {
      return lost(null);
    }
    socket = ws;
    ws.onopen = () => {
      if (socket !== ws) return;
      failures = 0;
      ping = timers.setInterval(() => send({ op: "ping" }), PING_EVERY);
      emit({ type: "open" });
    };
    ws.onmessage = (event) => {
      if (socket !== ws) return;
      let message;
      try {
        message = JSON.parse(String(event.data));
      } catch {
        return; // Not JSON: not from a relay that speaks this protocol.
      }
      if (message && typeof message === "object" && typeof message.op === "string") {
        emit({ type: "message", message });
      }
    };
    ws.onclose = () => lost(ws);
    ws.onerror = () => {
      // A close always follows an error; that's where the retry starts.
    };
  }

  /** The socket closed or never opened: try again later while wanted. */
  function lost(ws) {
    if (ws && socket !== ws) return;
    const wasOpen = ws !== null && failures === 0 && ping !== null;
    socket = null;
    stopTimers();
    if (wasOpen) emit({ type: "close" });
    if (!wanted) return;
    failures += 1;
    if (failures === OFFLINE_AFTER) emit({ type: "offline" });
    const wait = BACKOFF[Math.min(failures - 1, BACKOFF.length - 1)];
    retry = timers.setTimeout(() => {
      retry = null;
      dial();
    }, wait);
  }

  /** Sends one message; false when the connection isn't open. */
  function send(message) {
    if (!socket || socket.readyState !== 1) return false;
    try {
      socket.send(JSON.stringify(message));
      return true;
    } catch {
      return false;
    }
  }

  return {
    /** Starts connecting (and reconnecting) until close(). */
    connect() {
      wanted = true;
      failures = 0;
      dial();
    },
    send,
    /** Whether the connection is open now. */
    isOpen: () => !!socket && socket.readyState === 1,
    /** Closes the connection for good (until connect() again). */
    close() {
      wanted = false;
      stopTimers();
      const ws = socket;
      socket = null;
      if (ws) {
        try {
          ws.close();
        } catch {
          // Already closing.
        }
      }
    },
  };
}
