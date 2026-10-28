/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Fake Tilefold host — file changes (tests only)
 *
 * `tf.fs.create`, `mkdir`, `rename`, `move` and `trash` (Tilefold 0.1.16,
 * `fs.write`) over the fake host's files, with Tilefold's rules: only
 * inside a pane's folder, never inside `.git`, never over another entry
 * (compared without case, as on macOS), never a pane's own folder, and a
 * name is one segment without `/`. The Trash asks first: `host.trashAnswer`
 * (true by default) is the user's answer, and each question is kept in
 * `host.trashAsked`. Every change is kept in `host.changes`.
 */

/** Adds the file changes to `tf.fs`; `fs` gives the host's folder helpers. */
export function addFileWrites(tf, host, { dirs, check, named, parentOf }) {
  host.trashAnswer = true;
  host.trashAsked = [];
  host.changes = [];
  const base = (p) => p.slice(p.lastIndexOf("/") + 1);
  const exists = (p) => dirs().has(p) || host.files.includes(p) || p in host.links;
  const taken = (p) =>
    [...dirs(), ...host.files].some((x) => x.toLowerCase() === p.toLowerCase() && x !== p) ||
    exists(p);
  const guard = (path) => {
    if (path.split("/").includes(".git")) throw named("ProtectedPathError", "inside .git");
    if (host.roots.includes(path)) throw named("PathNotAllowedError", "a pane's own folder");
  };
  const nameOk = (name) => {
    if (typeof name !== "string" || !name || name.includes("/") || name.length > 255) {
      throw named("InvalidNameError", "bad name");
    }
  };
  /** Moves `from` (and what's inside) to `to`. */
  const relocate = (from, to) => {
    const move = (p) => (p === from || p.startsWith(`${from}/`) ? to + p.slice(from.length) : p);
    host.files = host.files.map(move);
    host.dirs = host.dirs.map(move);
  };
  Object.assign(tf.fs, {
    async create(dir, name) {
      nameOk(name);
      const folder = check(dir);
      const path = `${folder}/${name}`;
      guard(path);
      if (taken(path)) throw named("AlreadyExistsError", "taken");
      host.files.push(path);
      host.changes.push(["create", path]);
      return path;
    },
    async mkdir(dir, name) {
      nameOk(name);
      const folder = check(dir);
      const path = `${folder}/${name}`;
      guard(path);
      if (taken(path)) throw named("AlreadyExistsError", "taken");
      host.dirs.push(path);
      host.changes.push(["mkdir", path]);
      return path;
    },
    async rename(raw, name) {
      nameOk(name);
      const from = check(raw);
      guard(from);
      const to = `${parentOf(from)}/${name}`;
      if (to === from) return to;
      if (taken(to)) throw named("AlreadyExistsError", "taken");
      relocate(from, to);
      host.changes.push(["rename", from, to]);
      return to;
    },
    async move(raw, toDir, name) {
      const from = check(raw);
      const folder = check(toDir);
      guard(from);
      const to = `${folder}/${name ?? base(from)}`;
      guard(to);
      if (folder === from || folder.startsWith(`${from}/`)) {
        throw named("PathNotAllowedError", "into itself");
      }
      if (to === from) return to;
      if (taken(to)) throw named("AlreadyExistsError", "taken");
      relocate(from, to);
      host.changes.push(["move", from, to]);
      return to;
    },
    async trash(raw) {
      const path = check(raw);
      guard(path);
      host.trashAsked.push(base(path));
      if (!host.trashAnswer) return false;
      const keep = (p) => p !== path && !p.startsWith(`${path}/`);
      host.files = host.files.filter(keep);
      host.dirs = host.dirs.filter(keep);
      host.changes.push(["trash", path]);
      return true;
    },
  });
}
