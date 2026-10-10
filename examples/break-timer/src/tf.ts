/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Break Timer — the parts of Tilefold's `tf` object this tile uses, typed.
 * Declare only what you call; the build strips these types away.
 */

export interface Tf {
  setting(key: string, defaultValue: number | string | boolean, description: string): void;
  command(title: string, run: () => unknown, options?: { id?: string }): void;
  on(event: "app.ready", handler: () => unknown): void;
  t(key: string, args?: Record<string, string | number>): string;
  toast(message: string): Promise<void>;
  settings: { get(key: string): unknown };
  store: {
    get(key: string): Promise<unknown>;
    set(key: string, value: unknown): Promise<void>;
    delete(key: string): Promise<void>;
  };
}
