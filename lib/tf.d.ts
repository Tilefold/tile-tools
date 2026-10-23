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
 * `auth`, `ai`, `page`, `panel`, `pane`, `fs`, `viewer` and `browser` are optional because an
 * older Tilefold doesn't have them; check before use.
 *
 * Modified 2026-10-17 (panel rows per tab): a panel row's `page`.
 *
 * Modified 2026-10-20 (agent input): a command's `input`, its handler's
 * argument and return value.
 *
 * Modified 2026-10-23 (changing files): `fs.create`, `mkdir`, `rename`,
 * `move` and `trash`, `viewer.open`'s `edit`, and their error names; panel
 * right-click menus, the `panel.menu` and `panel.dblclick` events and
 * `panel.edit`.
 *
 * Last updated by: Tilefold
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
  | "page.message"
  | "pane.cwd"
  | "pane.list"
  | "panel.click"
  | "panel.closed"
  | "panel.menu"
  | "panel.dblclick"
  | "browser.navigated"
  | "browser.closed";

/** One of the user's panes, as tf.pane.list() and the "pane.list" event give it. */
export interface PaneInfo {
  /** The pane's session: what its programs see as TILEFOLD_SESSION_ID; null while no shell runs. */
  session: string | null;
  /** The name the user gave the pane, or null. */
  name: string | null;
  /** The folder the pane is in, or null when none is known. */
  folder: string | null;
  /** True for the focused pane. */
  focused: boolean;
}

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
  /** The focused pane's folder changed (needs pane.cwd); null when none is known. */
  "pane.cwd": { path: string | null };
  /** A pane opened, closed, was renamed, moved folder or took focus (needs pane.list). */
  "pane.list": { panes: PaneInfo[] };
  /** A row of the tile's docked panel was clicked (needs window.panel). */
  "panel.click": { row: string; action: "activate" | "expand" | "collapse" };
  /** The tile's panel was closed by the user, or replaced by another tile's. */
  "panel.closed": { by: "user" | "replaced" };
  /** A right-click menu's choice: the row (null for the empty space) and the item (Tilefold 0.1.16). */
  "panel.menu": { row: string | null; item: string };
  /** A row of the panel was double-clicked, after its two `panel.click` events (Tilefold 0.1.16). */
  "panel.dblclick": { row: string };
  /**
   * The tile's browser finished loading a page, or its title changed (needs
   * browser). `page` names which of the tile's pages, for a named one.
   */
  "browser.navigated": { url: string; title: string; page?: string };
  /** The user closed one of the tile's browser pages (needs browser). */
  "browser.closed": { url: string; page?: string };
}

/** An icon Tilefold draws in a panel row; `file` picks a file-type icon from the label. */
export type PanelIcon = "folder" | "file" | "link" | "loading" | "error" | "info" | "none";

/** A theme colour a panel row may take. */
export type PanelTone = "accent" | "info" | "success" | "warning" | "error";
/** One line of a docked panel. */
export interface PanelRow {
  /** Unique in the panel, 1–1,024 characters; `panel.click` sends it back. */
  id: string;
  /** Shown as plain text, 1–256 characters. */
  label: string;
  /** Indent, from 0 (drawn at most 32 deep). */
  depth?: number;
  icon?: PanelIcon;
  /** The row opens and closes (a folder); `expanded` draws it open. */
  expandable?: boolean;
  expanded?: boolean;
  /** A quiet note, such as "Loading…". */
  muted?: boolean;
  /** A tooltip, at most 512 characters. */
  hint?: string;
  /** Drawn as a section heading (Tilefold 0.1.11). */
  section?: boolean;
  /** A theme colour for the row's icon, label and badge (Tilefold 0.1.11). */
  tone?: PanelTone;
  /** A short pill after the label, at most 32 characters (Tilefold 0.1.11). */
  badge?: string;
  /** A short muted text at the row's end, such as "2m", at most 32 characters (Tilefold 0.1.11). */
  trail?: string;
  /** A pulsing dot: something is happening now (Tilefold 0.1.11). */
  pulse?: boolean;
  /**
   * The tile's browser page the row belongs to: a page name (as in
   * `tf.browser.page(name)`), or "" for the first page. Each tab's panel
   * then lists only the rows for the pages docked there (Tilefold 0.1.11).
   */
  page?: string; /** The menu (one of the panel's `menus`) a right-click on the row opens (Tilefold 0.1.16). */
  menu?: string;
}

/** The page a tile's browser window shows. */
export interface BrowserPage {
  url: string;
  title: string;
  /** Beside the panes (true) or in a window of its own (Tilefold 0.1.11). */
  docked?: boolean;
  /** The page's name, for a named page (`tf.browser.page(name)`). */
  page?: string;
}

/** One browser page of a tile: the first (`tf.browser`) or a named one. */
export interface BrowserPageApi {
  /** `{ docked: true }` shows it beside the panes (Tilefold 0.1.11); left out, a window. */
  open(url?: string, options?: { docked?: boolean }): Promise<BrowserPage>;
  /** Moves an open page beside the panes (true) or into a window of its own. */
  dock(docked: boolean): Promise<null>;
  go(url: string): Promise<null>;
  back(): Promise<null>;
  forward(): Promise<null>;
  reload(): Promise<null>;
  close(): Promise<null>;
  /** What the page shows, or null when it is closed. */
  info(): Promise<BrowserPage | null>;
}

/** What `tf.panel.show` takes. */
export interface PanelContent {
  title: string;
  subtitle?: string;
  /** At most 5,000, the footer's included. */
  rows: PanelRow[];
  /**
   * Rows pinned to the bottom of the panel: they take the room they need,
   * up to half the panel, then scroll inside (Tilefold 0.1.11; older ones
   * ignore it). Ids are unique across `rows` and the footer.
   */
  footer?: { rows: PanelRow[] };
  /**
   * Right-click menus rows name with `menu` (Tilefold 0.1.16; older ones
   * ignore them): at most 8, each at most 12 lines. Tilefold draws them.
   */
  menus?: Record<string, PanelMenuEntry[]>;
  /** The menu for a right-click on the empty space under the rows. */
  menu?: string;
}

/** One line of a panel menu: an item (id 1–32 lowercase letters, digits, dashes) or a line. */
export type PanelMenuEntry = { id: string; label: string; tone?: "error" } | { separator: true };

/** One name in a folder listing. */
export interface FolderEntry {
  name: string;
  /** A link may lead to a folder or a file; list or open it to find out. */
  kind: "dir" | "file" | "link" | "other";
}

/** One level of a folder, from `tf.fs.list`. */
export interface FolderListing {
  /** The folder with links resolved: build child paths from it. */
  path: string;
  /** Folders first, then by name; at most 2,000. */
  entries: FolderEntry[];
  /** True when the folder had more entries than were returned. */
  truncated: boolean;
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
  | "RefusedError"
  | "PathNotAllowedError"
  | "BrowserError"
  | "NotFoundError"
  | "NotADirectoryError"
  | "NotAFileError"
  | "UnreadableError"
  | "AlreadyExistsError"
  | "InvalidNameError"
  | "ProtectedPathError";

/** The object a tile's default export receives. */
export interface Tf {
  /**
   * Adds a palette command; the handler has 10 seconds. Always give an `id`.
   * With `input` (what it takes, up to 300 characters), AI agents may run it
   * with data: the handler gets it (`null` from the palette), and what it
   * returns, as plain JSON of at most 64 KB, goes back to the agent.
   */
  command(
    title: string,
    handler: (input: unknown) => unknown,
    options?: { id?: string; key?: Shortcut; input?: string },
  ): void;
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
   * with `keepRunning: true` closing its window only hides it, and an open
   * that leaves `keepRunning` out keeps the current choice. `origin: "https"`
   * (Tilefold 0.1.9, macOS) gives the page a web address of its own, which
   * some embedded players (YouTube's) require; the page is then one
   * self-contained document. `dock` (Tilefold 0.1.11) shows the page
   * docked in Tilefold's window at that spot (content CSS pixels, 120 to
   * 2,000 a side) instead of in a window of its own; `dock()` moves it
   * there, and is missing before 0.1.11. `post` sends plain JSON to the
   * open page. Missing on a Tilefold without tile pages.
   */
  readonly page?: {
    open(options?: {
      visible?: boolean;
      keepRunning?: boolean;
      origin?: "https";
      dock?: Rect;
    }): Promise<null>;
    dock?(spot: Rect): Promise<null>;
    close(): Promise<null>;
    post(message: unknown): Promise<null>;
  };
  /**
   * Needs browser. A browser Tilefold draws, beside the panes or in a
   * window of its own, with its own bar
   * (address, back, forward, reload, open in the default browser) above the
   * page. Any http or https address opens, local ones (`localhost:5173`)
   * included; a bare local host gets http://, others https://. The tile can
   * steer the window but never see the page; "browser.navigated" says where
   * it went. `open` without an address shows it empty, waiting for one. A
   * refused address rejects with a BrowserError. Missing before Tilefold
   * 0.1.11.
   *
   * `tf.browser` is the tile's first page; `page(name)` is another, so a
   * tile can keep several open at once (say one per port of the app it
   * previews). Names are 1 to 32 lowercase letters, digits and dashes
   * ("3000", "api"); a bad one throws a TypeError.
   */
  readonly browser?: BrowserPageApi & {
    /** The tile's page called `name`, with the same methods. */
    page(name: string): BrowserPageApi;
  };
  /**
   * Needs window.panel. A panel docked beside the panes, drawn by Tilefold
   * from your rows; each `show` replaces it. Missing before Tilefold 0.1.9.
   */
  readonly panel?: {
    show(content: PanelContent): Promise<boolean>;
    hide(): Promise<null>;
    /**
     * Turns a row's label into a text field in place (Tilefold 0.1.16;
     * missing before): resolves to the text typed (Enter), or null when the
     * user cancels (Escape, clicking away) or the row goes away. `selectTo`
     * is where the first selection ends (the name without its extension).
     */
    edit?(row: string, options?: { value?: string; selectTo?: number }): Promise<string | null>;
  };
  /**
   * Needs pane.cwd. The folder the focused pane is in, or null; the
   * "pane.cwd" event says when it changes. Missing before Tilefold 0.1.9.
   */
  readonly pane?: {
    cwd(): Promise<string | null>;
    /**
     * Needs pane.list. Every pane in every tab, in layout order. Missing
     * before Tilefold 0.1.11.
     */
    list?(): Promise<PaneInfo[]>;
  };
  /**
   * Needs fs.list. One level of a folder inside a folder one of the user's
   * panes is in: names and kinds only, never file contents. Missing before
   * Tilefold 0.1.9.
   */
  readonly fs?: {
    list(path: string): Promise<FolderListing>;
    /**
     * Needs fs.write. Changes inside a pane's folder, each resolving to
     * the entry's new path: an empty file, a folder, a new name in the same
     * folder, a move to another folder (optionally renamed). Never over
     * another entry, never inside `.git`, never a pane's own folder. The
     * tile never reads or writes what is in a file. Missing before
     * Tilefold 0.1.16.
     */
    create?(dir: string, name: string): Promise<string>;
    mkdir?(dir: string, name: string): Promise<string>;
    rename?(path: string, name: string): Promise<string>;
    move?(path: string, toDir: string, name?: string): Promise<string>;
    /**
     * Needs fs.write. Moves an entry to the Trash after Tilefold asks the
     * user: true when it went, false when they said no. Missing before
     * Tilefold 0.1.16.
     */
    trash?(path: string): Promise<boolean>;
  };
  /**
   * Needs viewer.open. Shows a file from inside a pane's folder in
   * Tilefold's document viewer; `{ edit: true }` (Tilefold 0.1.16) opens it
   * ready to edit. Missing before Tilefold 0.1.9.
   */
  readonly viewer?: { open(path: string, options?: { edit?: boolean }): Promise<null> };
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
