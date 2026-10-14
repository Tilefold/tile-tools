/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Pipeline Board — GitLab API
 *
 * The one request the tile makes, and how to read its answer:
 *
 *   GET https://gitlab.com/api/v4/projects/<group%2Fproject>/pipelines
 *       ?per_page=4&order_by=id&sort=desc[&ref=<branch>]
 *
 * The tile never holds a token: it names its `gitlab` sign-in on the
 * request (`tf.net.fetch(url, { auth: "gitlab" })`) and Tilefold adds the
 * user's token, refreshing it when it runs out. Pure: no `tf`, no network.
 */

/** The GitLab API the tile reads. */
export const API = "https://gitlab.com/api/v4";

/** How many pipelines the board shows. */
export const ROWS = 4;

/** The name of the sign-in declared in tile.json. */
export const SIGN_IN = "gitlab";

/**
 * A project path the user typed, such as "gitlab-org/gitlab", cleaned up;
 * "" when it isn't one. Accepts a pasted project address too.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function cleanProject(value) {
  if (typeof value !== "string") return "";
  let path = value.trim();
  const fromUrl = /^https:\/\/gitlab\.com\/(.+?)(?:\/-\/.*)?\/?$/.exec(path);
  if (fromUrl) path = fromUrl[1];
  path = path.replace(/^\/+|\/+$/g, "").replace(/\.git$/, "");
  // Groups and subgroups, then the project. Each part starts with a letter,
  // digit or "_" (as GitLab requires), so "." and ".." never pass.
  const part = /^[A-Za-z0-9_][\w.-]*$/;
  const parts = path.split("/");
  return parts.length >= 2 && parts.every((x) => part.test(x)) && path.length <= 255 ? path : "";
}

/** A branch name the user typed, or "" for every branch. */
export function cleanRef(value) {
  if (typeof value !== "string") return "";
  const ref = value.trim();
  return /^[^\s~^:?*[\\]{1,200}$/.test(ref) ? ref : "";
}

/**
 * The request for a project's latest pipelines.
 *
 * @param {string} project A cleaned project path.
 * @param {string} [ref] A branch, or "" for every branch.
 * @returns {string}
 */
export function pipelinesUrl(project, ref = "") {
  const params = new URLSearchParams({ per_page: String(ROWS), order_by: "id", sort: "desc" });
  if (ref) params.set("ref", ref);
  return `${API}/projects/${encodeURIComponent(project)}/pipelines?${params}`;
}

/**
 * The pipelines in an answer, newest first, with only what the board shows.
 * Anything that isn't a pipeline is skipped.
 *
 * @param {unknown} json
 * @returns {{ id: number, iid: number, status: string, ref: string, updatedAt: string }[]}
 */
export function parsePipelines(json) {
  if (!Array.isArray(json)) return [];
  const out = [];
  for (const p of json) {
    if (!p || typeof p !== "object") continue;
    const id = Number(p.id);
    if (!Number.isInteger(id)) continue;
    out.push({
      id,
      iid: Number.isInteger(Number(p.iid)) ? Number(p.iid) : id,
      status: typeof p.status === "string" ? p.status : "unknown",
      ref: typeof p.ref === "string" ? p.ref.slice(0, 120) : "",
      updatedAt: typeof p.updated_at === "string" ? p.updated_at : String(p.created_at ?? ""),
    });
  }
  return out.slice(0, ROWS);
}

/**
 * What a failed request means for the board.
 *
 * - "signed-out": Tilefold has no GitLab sign-in for the tile, or GitLab
 *   refused the token (401)
 * - "not-found": no such project, or the user can't see it (404, 403)
 * - "denied": Tilefold refused the request; nothing reached GitLab
 * - "rate": too many requests; slow down
 * - "error": anything else; try again at the next check
 *
 * @param {{ name?: string } | null} err A thrown error, or null.
 * @param {number} [status] The HTTP status of an answer that wasn't OK.
 * @returns {"signed-out" | "not-found" | "denied" | "rate" | "error"}
 */
export function failureOf(err, status = 0) {
  const name = err && typeof err === "object" ? err.name : "";
  if (name === "CredentialMissingError") return "signed-out";
  if (name === "PermissionDeniedError" || name === "NetworkPolicyError") return "denied";
  if (name === "RateLimitError") return "rate";
  if (status === 401) return "signed-out";
  if (status === 403 || status === 404) return "not-found";
  if (status === 429) return "rate";
  return "error";
}
