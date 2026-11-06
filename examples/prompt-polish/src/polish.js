/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Prompt Polish — the text: what is never changed, and what changed
 *
 * - Protected spans: code in backticks (and fenced blocks), links and file
 *   paths. An agent needs them exactly as written, so the tile tells
 *   Claude to leave them alone and refuses an answer that changed one.
 * - A diff of the prompt and its corrected version, by tokens: a Latin
 *   word stays whole, every other letter (Hangul, kana, Han…) is its own
 *   token, so a Korean spacing fix or a Japanese particle shows as itself.
 * - Changes the user accepts or undoes one by one, and the text that
 *   results.
 *
 * Pure: no Tilefold calls.
 */

/** The longest prompt the tile checks, in characters: it bounds the cost and the diff. */
export const MAX_CHARS = 2000;

/** Above this many cells the diff gives up on detail and shows one change (keeps the worker quick). */
const MAX_CELLS = 4_000_000;

/*
 * Never changed: ```fenced blocks```, `code`, http(s) links, and paths
 * (two or more parts joined by "/", optionally starting with ~/ ./ ../ or /).
 */
const PROTECTED =
  /```[\s\S]*?```|`[^`\n]*`|https?:\/\/[^\s)]+|(?:~|\.{1,2})?\/?[\w.-]+(?:\/[\w.-]+)+/g;

/**
 * The spans of `text` that are never changed, in order.
 *
 * @param {string} text
 * @returns {{ start: number, end: number, text: string }[]}
 */
export function protectedSpans(text) {
  const spans = [];
  for (const m of String(text ?? "").matchAll(PROTECTED)) {
    spans.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
  }
  return spans;
}

/**
 * Whether `corrected` still holds every protected span of `original`, in
 * the same order (Claude may move text around them, never change them).
 */
export function keepsProtected(original, corrected) {
  let at = 0;
  for (const s of protectedSpans(original)) {
    const found = String(corrected).indexOf(s.text, at);
    if (found < 0) return false;
    at = found + s.text.length;
  }
  return true;
}

/*
 * Tokens: a run of spaces, a whole `code` span, a Latin word (with digits,
 * accents, apostrophes and hyphens), or any other single character.
 */
const TOKEN = /\s+|`[^`\n]*`|[\p{Script=Latin}\p{N}_'’-]+|[\s\S]/gu;

/** Splits text into diff tokens. */
export const tokenize = (text) => String(text ?? "").match(TOKEN) ?? [];

/**
 * A diff of `a` and `b` by tokens (longest common subsequence): ops of
 * `{ op: "same" | "del" | "ins", text }`, neighbours of one kind merged.
 * The common start and end are taken off first, so only the middle is
 * compared; a middle too big to compare in detail is one change.
 */
export function diff(a, b) {
  const x = tokenize(a);
  const y = tokenize(b);
  let head = 0;
  while (head < x.length && head < y.length && x[head] === y[head]) head++;
  let tail = 0;
  while (
    tail < x.length - head &&
    tail < y.length - head &&
    x[x.length - 1 - tail] === y[y.length - 1 - tail]
  ) {
    tail++;
  }
  const ops = [];
  const push = (op, text) => {
    if (!text) return;
    const last = ops[ops.length - 1];
    if (last && last.op === op) last.text += text;
    else ops.push({ op, text });
  };
  push("same", x.slice(0, head).join(""));
  const xm = x.slice(head, x.length - tail);
  const ym = y.slice(head, y.length - tail);
  const n = xm.length;
  const m = ym.length;
  if ((n + 1) * (m + 1) > MAX_CELLS) {
    push("del", xm.join(""));
    push("ins", ym.join(""));
  } else {
    // lcs[i][j]: how long the common run of xm[i..] and ym[j..] is.
    const lcs = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        lcs[i][j] =
          xm[i] === ym[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (xm[i] === ym[j]) {
        push("same", xm[i]);
        i++;
        j++;
      } else if (lcs[i + 1][j] >= lcs[i][j + 1]) push("del", xm[i++]);
      else push("ins", ym[j++]);
    }
    while (i < n) push("del", xm[i++]);
    while (j < m) push("ins", ym[j++]);
  }
  push("same", x.slice(x.length - tail).join(""));
  return ops;
}

/**
 * The diff as parts the user works with: `{ same }`, or a change
 * `{ id, del, ins }` (a removal and the addition next to it are one
 * change). Ids count from 1 in reading order.
 */
export function changes(ops) {
  const parts = [];
  let id = 0;
  for (let k = 0; k < ops.length; k++) {
    const o = ops[k];
    if (o.op === "same") {
      parts.push({ same: o.text });
      continue;
    }
    const c = { id: ++id, del: "", ins: "" };
    c[o.op] = o.text;
    const next = ops[k + 1];
    if (next && next.op !== "same" && next.op !== o.op) {
      c[next.op] = next.text;
      k++;
    }
    parts.push(c);
  }
  return parts;
}

/** The text that results with the changes whose ids are in `rejected` undone. */
export function build(parts, rejected) {
  const no = rejected instanceof Set ? rejected : new Set(rejected ?? []);
  return parts.map((p) => ("same" in p ? p.same : no.has(p.id) ? p.del : p.ins)).join("");
}

/** How many changes the parts hold. */
export const changeCount = (parts) => parts.filter((p) => !("same" in p)).length;

/** Why a prompt can't be checked ("empty", "too-long"), or "" when it can. */
export function blocker(text) {
  const t = String(text ?? "").trim();
  if (!t) return "empty";
  if (t.length > MAX_CHARS) return "too-long";
  return "";
}
