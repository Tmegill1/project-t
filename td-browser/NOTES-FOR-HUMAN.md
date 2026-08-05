# Notes for human

Findings, proposals, and blocked items from the `feat/strategic-depth` build.
Nothing here has been acted on — these are all either out of the current phase's
scope, or decisions that are not mine to make.

Newest sections are appended at the bottom.

---

## Proposed deletions

Per the operating rules I have not deleted anything I did not create. These are
proposals.

### 1. `src/scenes/GameScene.old.ts` — 1,464 lines of dead code

**Evidence it is dead:** nothing in `src/` or `index.html` imports it. `main.ts`
registers `GameScene` from `./scenes/GameScene.ts`.

**Why deleting it is worth doing anyway:** `tsconfig.json` has `include: ["src"]`,
so it is still type-checked on every build. It imports `CircleEnemy`, `SquareEnemy`,
`TriangleEnemy`, `BasicTower`, `FastTower`, and `LongRangeTower`. That means it
constrains renames elsewhere in the codebase — the Step 0.8 enemy renames only stay
`tsc`-clean because deprecated aliases are retained. It is dead code that still
votes on the design.

It does not reach the production bundle (Vite tree-shakes from `main.ts`), so this
is a maintainability cost, not a load-size one.

**Recommendation:** delete. It is recoverable from git history.

### 2. Duplicate root-level assets — 6.3 MB

Verified md5-identical:

| Root copy | `public/` copy | md5 |
|---|---|---|
| `different sprite assest.png` (3.9 MB) | `public/map-sprites.png` | `578fbe5b…` |
| `tower TD background.png` (2.6 MB) | `public/tower-td-background.png` | `c15507d5…` |

Only the `public/` copies are served — `BootScene` loads `/map-sprites.png` and
`/tower-td-background.png`, which Vite resolves from `public/`. The root copies are
committed but unused.

**Recommendation:** delete both root copies. This does not change bundle size (they
were never bundled), but it halves what a fresh `git clone` has to pull.

**Separately worth a look:** `public/map-sprites.png` is a 3.9 MB PNG that
`BootScene` loads and slices manually at runtime. Load size is a portal ranking
factor, and this single file is the bulk of the payload. Compressing it, or
pre-slicing it into a proper atlas, is likely the highest-leverage load-time win
available. I have not touched it — it is out of Phase 0 scope and would need visual
verification.

---

## Bugs found during the Step 0.2 audit

Found while reading, not while looking for bugs. All are **pre-existing** and none
are touched by Phase 0, whose definition of done requires that visible behaviour not
change.

### 1. 30% of map2's buildable tiles are unreachable — **live gameplay bug**

`src/game/map/Grid.ts:1` imports `GRID_COLS` and `GRID_ROWS` from `demoMap` (23×14).
`worldToTile()` uses them for its `inBounds` check. But map2 is 26×17, and
`GameScene.handleTowerPlacement()` bails out when `inBounds` is false.

Measured against the actual map data: **111 of map2's 365 buildable tiles (30.4%)
report out-of-bounds.** The rightmost three columns and bottom three rows of map2
silently reject every click — no error, no feedback, the tower just does not appear.

`TILE_SIZE` is 48 in both maps, so pixel↔tile conversion is correct today. Only the
bounds check is wrong.

**Fix sketch:** `worldToTile` needs the active map's dimensions rather than importing
demoMap's. Since `GameScene` already tracks `currentMap`, passing dimensions in — or
deriving them from `currentMap.length` / `currentMap[0].length` — is a contained
change.

**Why I have not fixed it:** it changes visible behaviour on map2, which Phase 0
explicitly forbids. It is also a genuine gameplay change (30% more build space on
map2 will affect balance), so it should be a deliberate decision rather than a
side effect of a refactor. **Recommend scheduling this early in Phase 1**, before
any balance tuning happens on top of the current constrained board.

### 2. `enemiesRemainingInWave` does not mean what it says

`GameScene.startWave()` initialises it to the wave's enemy total, then decrements it
inside each **spawn** callback. It therefore reaches zero when the last enemy
*spawns*, not when the last enemy *dies*.

Wave completion works anyway, because the condition is
`enemiesRemainingInWave <= 0 && enemies.children.size === 0` — the second clause is
doing the real work. The variable is effectively an "all spawned" flag with a
misleading name.

Not harmful today. Flagged because Phase 2 lieutenants and Phase 3 boss adds both
add enemies mid-wave, and anyone reasoning about this counter will get it wrong.

### 3. `check-tower-cost` is a listener with no emitter

`UIScene.ts:63` registers a handler for `check-tower-cost` with a callback-style
payload. Nothing anywhere emits it. Affordability is checked by the direct call
`uiScene.canAfford(cost)` instead. Dead code.

### 4. Wave completion is detected in two independent places

Both `GameScene.update()` (inline check) and `startWaveCompletionCheck()` (a
500 ms polling `time.addEvent`) call `onWaveComplete()`. `onWaveComplete()` is not
idempotent — it schedules the next wave via `delayedCall`. It appears not to
double-fire in practice because `isWaveActive` is cleared first, but the redundancy
is unnecessary and the polling timer is never destroyed on the `update()` path.

---

## Environment notes

### Working copy moved to a WSL-local clone

**Approved before starting.** Work happens in `~/project-t`, not in the OneDrive
checkout at `/mnt/c/Users/Tyler/OneDrive/Documents/GitHub/project-t`.

Reason: `node_modules` in the OneDrive checkout was installed from Windows, so it
contains `@rollup/rollup-win32-x64-msvc` and not `@rollup/rollup-linux-x64-gnu`.
`npm run build` fails outright from WSL with `Cannot find module
'@rollup/rollup-linux-x64-gnu'`. (`tsc --noEmit` was unaffected — it is pure JS.)

The WSL clone also avoids OneDrive syncing 205 MB of `node_modules` mid-run, and is
substantially faster on a native filesystem.

**Your Windows checkout is untouched and still works.** To get this work there:

```
git fetch origin
git checkout feat/strategic-depth
npm install     # only if you want to run it from Windows
```

### Line endings — `.gitattributes` added

**Approved before starting.** Your Windows checkout showed all 39 tracked files as
modified: 8,100 insertions and 8,100 deletions, which is every line of every file.
`git diff --ignore-cr-at-eol` was empty, confirming it was purely CRLF churn.

The committed blobs were already LF — only the Windows *working tree* had CRLF. So
`git add --renormalize .` produced zero content changes, and no noisy normalisation
commit was needed. The `.gitattributes` (`* text=auto eol=lf`, plus binary
declarations for images and fonts) pins the working-tree side so this cannot recur.

**One thing to check on your end:** after pulling this branch on Windows, your
working tree will convert to LF. Modern editors handle this transparently, but if
you have tooling that requires CRLF, say so and I will adjust the rule.

### Branch base

Branched from `main` (`8fef6ed`), not from the checked-out `Day-4-`. `Day-4-` was
already merged into `main` via PR #14 and is 7 commits behind it. Approved before
starting.

### npm audit

`npm install` reports 4 high-severity vulnerabilities. I have not run `npm audit
fix` — it can change dependency versions, and dependency changes need your sign-off
per the operating rules. Worth a look when convenient.

---

## Constraints discovered that the build plan did not anticipate

### `erasableSyntaxOnly: true` forbids `enum`

`tsconfig.json` sets `erasableSyntaxOnly`, which bans TypeScript syntax requiring
runtime emit: `enum`, constructor parameter properties, and `namespace`.

This directly affects the `sim/` layer. Enemy properties, damage kinds, targeting
priorities, and upgrade branches all want to be enums and cannot be. The pattern
used instead:

```ts
export const EnemyProperty = {
  Armored: "armored",
  Shielded: "shielded",
} as const;
export type EnemyProperty = (typeof EnemyProperty)[keyof typeof EnemyProperty];
```

This is arguably better for a data-driven design — the values are plain strings, so
they serialise cleanly into the Phase 4 save schema without a mapping layer. Noting
it because it is a real constraint on every subsequent phase, not a preference.

### The economy lives in the view layer

`money` and `lives` are **private fields on `UIScene`**, a `Phaser.Scene` subclass
(`UIScene.ts:7-8`). The build plan's Step 0.3 asks for `sim/economy.ts` as pure
currency math, which is straightforward — but the *authoritative balance* cannot be
moved out of `UIScene` without changing behaviour, which Phase 0 forbids.

**Approach taken:** `sim/economy.ts` holds pure functions; `UIScene` keeps the total
and delegates the arithmetic. The state move itself is a natural fit for Phase 2,
which introduces two more currencies (Insignia, Seals) and will need a real
multi-currency owner anyway. Flagging so the Phase 2 design accounts for it.
