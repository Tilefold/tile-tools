/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree — changing files
 *
 * New file, new folder, rename, move and Move to Trash, from the panel's
 * commands and the window's buttons, keys and drags (Tilefold 0.1.16, with
 * the `fs.write` permission). A new file gets a free "untitled" name in
 * the chosen folder and opens in Tilefold's document viewer ready to edit
 * (`tf.viewer.open(path, { edit: true })`): the tile itself never reads or
 * writes what is in a file. Tilefold never lets a change replace another
 * entry, reach into `.git`, or leave the user's pane folders, and asks the
 * user before anything goes to the Trash. After each change the folders
 * involved are listed again. Each change is recorded in the activity log by
 * kind only, never a name or path.
 *
 * The target of an action is a row id from either view (folders and files
 * are both rows): a folder row means "in this folder", a file row "in its
 * folder", and no row the tree's own folder.
 */
import { parentKey } from "./model.js";
import { basename } from "./paths.js";

/** The message for each error Tilefold may give a change. */
export const EDIT_ERROR_KEYS = {
  AlreadyExistsError: "error-exists",
  InvalidNameError: "error-bad-name",
  ProtectedPathError: "error-protected",
  PermissionDeniedError: "error-no-write",
  PathNotAllowedError: "error-not-allowed",
  NotFoundError: "error-not-found",
  RateLimitError: "error-busy",
};

/** Most "untitled" names tried before giving up. */
const MAX_TRIES = 200;

/**
 * The first of `name`, `name 2`, `name 3`… not in `taken` (compared without
 * case, as macOS does): "untitled.md" → "untitled 2.md".
 */
export function freeName(taken, name) {
  const lower = new Set([...taken].map((n) => n.toLowerCase()));
  if (!lower.has(name.toLowerCase())) return name;
  const dot = name.lastIndexOf(".");
  const [stem, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
  for (let i = 2; i < MAX_TRIES; i++) {
    const next = `${stem} ${i}${ext}`;
    if (!lower.has(next.toLowerCase())) return next;
  }
  return null;
}

/** True when `tf` can change files (Tilefold 0.1.16 and later). */
export const canEdit = (tf) => typeof tf.fs?.create === "function";

/**
 * The file changes for one tree. `host` gives `tree()` (the current tree),
 * `target(id)` (what a row stands for), `relist(key)` (lists a loaded
 * folder again, quietly) and `explain(err)` (a message for any other error).
 */
export function createEdits(tf, host) {
  /** The folder key an action on row `id` works in (see the module comment). */
  const folderOf = (id) => {
    const tree = host.tree();
    const target = id ? host.target(id) : null;
    // A folder row is its own folder, listed yet or not.
    if (target?.kind === "dir") return target.path;
    if (target) return parentKey(tree, target.path) ?? tree.root;
    return tree.root;
  };

  /** A notice for a failed change, in the user's language. */
  const fail = (err) => {
    const key = EDIT_ERROR_KEYS[err?.name];
    return tf.toast(key ? tf.t(key) : host.explain(err));
  };

  /** Runs a change unless this Tilefold can't, then says what went wrong. */
  const guarded = async (change) => {
    if (!canEdit(tf)) return tf.toast(tf.t("needs-tilefold-edit"));
    try {
      return await change();
    } catch (err) {
      return fail(err);
    }
  };

  /** Creates a file or folder with a free "untitled" name in the folder for `id`. */
  const create = (id, kind) =>
    guarded(async () => {
      const key = folderOf(id);
      if (!key) return tf.toast(tf.t("error-no-folder"));
      const dir = host.tree().folders[key]?.path ?? key;
      const listing = await tf.fs.list(dir);
      const name = freeName(
        listing.entries.map((e) => e.name),
        tf.t(kind === "dir" ? "new-folder-name" : "new-file-name"),
      );
      if (!name) return tf.toast(tf.t("error-exists"));
      const path = kind === "dir" ? await tf.fs.mkdir(dir, name) : await tf.fs.create(dir, name);
      await host.relist(key);
      await tf.audit(kind === "dir" ? "folder-created" : "file-created", {});
      if (kind !== "dir") await tf.viewer.open(path, { edit: true });
      return path;
    });

  return {
    /** A new file in the folder for row `id`, opened ready to edit. */
    newFile: (id) => create(id, "file"),
    /** A new folder in the folder for row `id`. */
    newFolder: (id) => create(id, "dir"),

    /** Renames row `id` to `name` (in the same folder). */
    rename: (id, name) =>
      guarded(async () => {
        const target = host.target(id);
        if (!target || typeof name !== "string" || !name.trim()) return undefined;
        if (name === basename(target.path)) return target.path;
        const path = await tf.fs.rename(target.path, name);
        await host.relist(parentKey(host.tree(), target.path) ?? host.tree().root);
        await tf.audit("renamed", {});
        return path;
      }),

    /** Moves row `id` into the folder row `to` (or the tree's own folder). */
    move: (id, to) =>
      guarded(async () => {
        const target = host.target(id);
        const into = folderOf(to);
        if (!target || !into) return undefined;
        const from = parentKey(host.tree(), target.path);
        if (from === into || into === target.path) return undefined;
        const dir = host.tree().folders[into]?.path ?? into;
        const path = await tf.fs.move(target.path, dir);
        if (from) await host.relist(from);
        await host.relist(into);
        await tf.audit("moved", {});
        return path;
      }),

    /** Moves row `id` to the Trash, once the user agrees (Tilefold asks). */
    trash: (id) =>
      guarded(async () => {
        const target = host.target(id);
        if (!target) return undefined;
        const from = parentKey(host.tree(), target.path);
        const gone = await tf.fs.trash(target.path);
        if (!gone) return false;
        if (from) await host.relist(from);
        await tf.audit("trashed", { kind: target.kind === "dir" ? "dir" : "file" });
        return true;
      }),

    /** Opens file row `id` in the viewer ready to edit. */
    edit: (id) =>
      guarded(async () => {
        const target = host.target(id);
        if (!target || target.kind === "dir") return undefined;
        await tf.viewer.open(target.path, { edit: true });
        await tf.audit("file-opened", { from: "edit" });
        return target.path;
      }),
  };
}
