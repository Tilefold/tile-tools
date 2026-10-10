# tile-tools — project instructions

This is the public, MIT-licensed repository of `@tilefold/tile-tools` (the
`tilefold-tile` command that bundles a Tilefold tile into its `main.js`).

## Identity

- Copyright **holder and author: Tilefold**. File headers read
  `Copyright (c) <year> Tilefold` / `Author: Tilefold` /
  `Released under the MIT License.`; README footers end
  `Last updated: <date> by Tilefold`.
- Git commits are authored as `Tilefold <npm@tilefold.com>` (set in this
  clone's git config). No personal names or addresses, and no references to
  other organisations or private repositories, in files, commits or PRs.
- npm: published from the npm account `tilefold`.

## Working here

- `npm test` (Vitest) and `npm pack --dry-run` must pass before a commit;
  CI runs both on Node.js 22, 24 and 26 on Linux, macOS and Windows.
- Formatting: Prettier with `.prettierrc.json` (print width 100).
- `lib/rules.mjs` mirrors the checks Tilefold's loader makes; change both
  together (the Tilefold app's tests compare them).
