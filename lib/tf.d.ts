/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * The `tf` object a Tilefold tile receives, typed.
 *
 *   import type { Tf } from "@tilefold/tile-tools/tf";
 *   export default (tf: Tf) => { ... };
 *
 * Types only: nothing here runs, and the build strips it away. `net`,
 * `auth` and `ai` are optional because a Tilefold without tile networking
 * and AI doesn't have them; check before use.
 */

/** JSON data, as `tf.store` and `tf.audit` accept it. */
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** A shortcut such as "Ctrl+Alt+N", the same everywhere or per platform. */
export type Shortcut = string | { mac?: string; other?: string };

/** Events a tile can listen to. */
export type TileEvent =
  | "app.ready"
  | "window.focused"
  | "window.blurred"
  | "user.idle"
  | "user.active"
  | "setting.changed"
  | "curtain.dismissed"
  | "overlay.pointer"
  | "overlay.layout"
  | "overlay.hidden"
  | "page.closed"
  | "page.message";

/** A rectangle in the window's content area, in CSS pixels. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where the panes are: rectangles only, never what they show. */
export interface OverlayLayout {
  content: { w: number; h: number };
  panes: Array<Rect & { id: string; focused: boolean; composer: Rect | null }>;
}

/** What each event's handler receives. */
export interface TileEventPayloads {
  "app.ready": Record<string, never>;
  "window.focused": Record<string, never>;
  "window.blurred": Record<string, never>;
  "user.idle": { minutes: number };
  "user.active": Record<string, never>;
  "setting.changed": { key: string };
  "curtain.dismissed": Record<string, never>;
  "overlay.pointer": {
    item: string;
    type: "click" | "dblclick" | "dragstart" | "drag" | "drop";
    x: number;
    y: number;
  };
  "overlay.layout": OverlayLayout;
  "overlay.hidden": { by: "user" };
  "page.closed": Record<string, never>;
  /** Plain JSON the tile's page sent with `window.tilefold.post`. */
  "page.message": { message: unknown };
}

/** One entry of a setting's drop-down. */
export type SettingChoice = string | { value: string; label?: string };

/** One picture in an overlay scene. */
export interface OverlayItem {
  id: string;
  /** A data:image/… URL (PNG, GIF, WebP, JPEG or SVG). */
  image: string;
  x?: number;
  y?: number;
  /** 1–256. */
  w?: number;
  h?: number;
  flip?: boolean;
  sheet?: { frames: number; fps: number } | null;
  anim?: "none" | "breathe" | "bob" | "bounce" | "shake" | "spin";
  /** Glide to a new position over this many ms (0–20,000). */
  moveMs?: number;
  bubble?: string | null;
  hit?: boolean;
  cursor?: "default" | "pointer" | "grab";
  label?: string | null;
  /** 0–1. */
  opacity?: number;
}

/** A change to a shown scene: items by id (only the fields given), ids to remove. */
export interface OverlayUpdate {
  items?: Array<Partial<OverlayItem> & { id: string }>;
  remove?: string[];
}

/** Options for `tf.net.fetch`. */
export interface NetFetchInit {
  method?: "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string> | Array<[string, string]>;
  /** At most 1 MB. */
  body?: string | null;
  /** A credential declared under `auth` in tile.json; Tilefold adds it. */
  auth?: string;
}

/** The answer to `tf.net.fetch`. */
export interface NetResponse {
  readonly status: number;
  readonly statusText: string;
  /** True for 200–299. */
  readonly ok: boolean;
  /** The final address, after redirects. */
  readonly url: string;
  /** Lowercase names; repeated headers joined with ", ". */
  readonly headers: Readonly<Record<string, string>>;
  text(): Promise<string>;
  json(): Promise<any>;
  bytes(): Promise<Uint8Array>;
}

/** A message in a question to Claude. */
export interface AiMessage {
  role: "user" | "assistant";
  content: string;
}

/** A question to Claude: a prompt, or a conversation ending with the user. */
export type AiAsk =
  | string
  | {
      prompt?: string;
      system?: string;
      messages?: AiMessage[];
      /** 1–16,000; 4,096 when left out. */
      maxTokens?: number;
      model?: "default" | "fast";
    };

/** Claude's answer. */
export interface AiAnswer {
  text: string;
  model: string;
  stopReason: string;
  usage: { inputTokens: number; outputTokens: number };
}

/** Error names a `tf` call can fail with (`err.name`). */
export type TileErrorName =
  | "PermissionDeniedError"
  | "RateLimitError"
  | "TypeError"
  | "NotSupportedError"
  | "LockNotSetUpError"
  | "NetworkPolicyError"
  | "CredentialMissingError"
  | "CredentialStoreError"
  | "TimeoutError"
  | "TooLargeError"
  | "NetworkError"
  | "AiNotSetUpError"
  | "AiDeclinedError"
  | "BudgetExceededError"
  | "RefusedError";

/** The object a tile's default export receives. */
export interface Tf {
  /** Adds a palette command; the handler has 10 seconds. Always give an `id`. */
  command(title: string, handler: () => unknown, options?: { id?: string; key?: Shortcut }): void;
  /** Adds a setting: a switch, number box, text box or (with choices) a drop-down. */
  setting(
    key: string,
    defaultValue: boolean | number | string,
    description: string,
    options?: { choices?: SettingChoice[] },
  ): void;
  /** Listens to an event; the handler has half a second. */
  on<E extends TileEvent>(event: E, handler: (payload: TileEventPayloads[E]) => unknown): void;
  /** Not available yet: throws. */
  guard(...args: unknown[]): never;
  /** Not available yet: throws. */
  rewrite(...args: unknown[]): never;
  /** A message from locales/<lang>/tile.ftl in the user's language; the key when missing. */
  t(key: string, args?: Record<string, string | number>): string;
  /** A notice of at most 300 characters; 5 per 10 seconds. */
  toast(message: string): Promise<null>;
  /** A record in the activity log, as tile.<id>.<action>. */
  audit(action: string, details?: Json): Promise<null>;
  /** Lines in the tile's Log in Settings → Tiles. */
  readonly log: {
    info(text: string): Promise<null>;
    warn(text: string): Promise<null>;
    error(text: string): Promise<null>;
  };
  /** The tile's own storage, kept across restarts. */
  readonly store: {
    get(key: string): Promise<Json>;
    set(key: string, value: Json): Promise<null>;
    delete(key: string): Promise<boolean>;
  };
  /** Current setting values, at once. */
  readonly settings: { get(key: string): boolean | number | string | undefined };
  /** Needs window.curtain (and window.lock for `lock`). */
  readonly curtain: {
    show(options?: {
      message?: string;
      plain?: boolean;
      dim?: number;
      lock?: boolean;
    }): Promise<null>;
    hide(): Promise<null>;
  };
  /** Needs window.protect. */
  readonly window: { protect(on: boolean): Promise<null> };
  /** Needs window.overlay. `show` and `update` resolve false while the user hides overlays. */
  readonly overlay: {
    show(scene: { items: OverlayItem[] }): Promise<boolean>;
    update(changes: OverlayUpdate): Promise<boolean>;
    hide(): Promise<null>;
    layout(): Promise<OverlayLayout>;
  };
  /** Needs sound.play. Resolves whether the sound will be heard. */
  readonly sound: {
    play(clip: string | { src: string; volume?: number }): Promise<boolean>;
  };
  /** Needs net:<host>. Missing on a Tilefold without tile networking. */
  readonly net?: { fetch(url: string, init?: NetFetchInit): Promise<NetResponse> };
  /** Whether the user set up a credential declared under `auth`. Never the secret. */
  readonly auth?: { has(name: string): Promise<boolean> };
  /** Needs ai.ask. Each question is shown to the user first. */
  readonly ai?: { ask(question: AiAsk): Promise<AiAnswer> };
  /**
   * Needs page. The tile's own web page (its page/ folder) in a window of
   * its own, or hidden ({ visible: false }) for one that only plays sound;
   * `post` sends plain JSON to the open page. Missing on a Tilefold
   * without tile pages.
   */
  readonly page?: {
    open(options?: { visible?: boolean }): Promise<null>;
    close(): Promise<null>;
    post(message: unknown): Promise<null>;
  };
}

/**
 * What Tilefold gives a tile's page as `window.tilefold` (in the page, not
 * in the tile). `token` returns a key or sign-in declared with
 * `"page": true` in tile.json.
 */
export interface TilePageBridge {
  post(message: unknown): Promise<void>;
  onMessage(listener: (message: unknown) => void): () => void;
  token(name: string): Promise<string>;
}
