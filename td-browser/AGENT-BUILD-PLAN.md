# Tower Defense — Agent Build Plan

Task spec, loop protocol, and progress log for the `feat/strategic-depth` work.

**On session start: read Section 7 (Progress Log) first and continue from the last
entry. Never restart a completed step.**

The full phase specifications (Phases 1–5, the pitfall to test against, scope
discipline) live in the originating task brief. This file carries the parts an
agent needs to resume: the operating rules, the loop, the hard gates, and the log.

---

## 1. Operating rules (non-negotiable)

1. **Branch first:** work on `feat/strategic-depth`. Never commit to `main`.
2. **Never** force-push, `git reset --hard` shared history, or delete files you did
   not create. Propose deletions in NOTES-FOR-HUMAN.md instead.
3. **Commit at every green checkpoint**, naming phase and step. Small commits.
4. **Dependency policy:** Vitest + jsdom + @vitest/coverage-v8 are pre-approved as
   dev dependencies. Any other dependency — especially any runtime dependency —
   requires asking first. Bundle size is a portal ranking factor.
5. **Do not refactor outside the current phase's scope.** Log unrelated findings in
   NOTES-FOR-HUMAN.md.
6. **`tsc` must pass** with the existing strict settings. `noUnusedLocals` and
   `noUnusedParameters` are on — prefix intentionally unused params with `_`.
7. **Resuming:** read Section 7 and continue from the last entry.

## 2. The loop protocol

Every step runs: READ → SPEC → RUN (confirm the new tests fail for the right
reason) → BUILD → VERIFY → COMMIT → LOG → NEXT.

VERIFY means all three of:

```
npx vitest run
npx tsc --noEmit
npm run build
```

**When stuck:** after 3 failed attempts on the same failing test, stop. Write the
problem, attempts, and best hypothesis to NOTES-FOR-HUMAN.md, then move to the next
independent step. Do not thrash.

**Never weaken a test to make it pass.** If a test is genuinely wrong, explain why
in NOTES-FOR-HUMAN.md before changing it.

## 3. STOP AND ASK — hard gates

The loop closes on correctness, not on fun. An agent cannot evaluate game feel.
Hand back to the human at these points:

- **End of every phase.** Report what shipped, how to test it, what to watch for.
- **Any balance number that is a judgment call** (damage, drop rates, costs,
  cooldowns, pacing). Implement data-driven with placeholders, flag as needing
  tuning.
- **Any change to core game feel** (movement speed, projectile travel, animation
  timing).
- **The Phase 4 storage decision** (localStorage vs D1 vs hybrid).
- **Any ambiguity in the spec.** Ask; do not guess at design intent.
- **Anything touching deployment, `worker/`, `wrangler.toml`, or CI.**

## 4. Environment

Work happens in a **WSL-local clone at `~/project-t`**, not the OneDrive checkout.
The OneDrive copy's `node_modules` holds Windows rollup binaries and `npm run
build` fails from WSL. See NOTES-FOR-HUMAN.md → Environment notes.

---

## 7. Progress log

Append after each completed step. Never delete prior entries.

### [Phase 0 — Setup] — 2026-08-04
Status: complete
Changed: `.gitattributes` (new)
Tests: n/a
Needs tuning: none
Notes: Three setup forks resolved with the human before any code. (1) Workspace
moved to a WSL-local clone — the OneDrive checkout's `node_modules` was installed
from Windows, so `npm run build` failed with a missing
`@rollup/rollup-linux-x64-gnu`. (2) Branched from `main` (`8fef6ed`), not the
checked-out `Day-4-`, which was 7 commits behind after PR #14. (3) Added
`.gitattributes` pinning LF. The Windows working tree was showing all 39 tracked
files as modified — 8,100 insertions and 8,100 deletions of pure CRLF churn.
Committed blobs were already LF, so `git add --renormalize .` was a no-op and no
normalisation commit was needed.

### [Phase 0 — Step 0.1 — Test infrastructure] — 2026-08-04
Status: complete
Changed: `package.json`, `vitest.config.ts` (new), `src/vitest-environment.test.ts`,
`src/vitest-jsdom.test.ts`
Tests: 3 added, 3 passing
Needs tuning: none
Notes: Vitest 4.1.10 + jsdom + coverage-v8. Default environment is `node`, not
jsdom — a DOM-free default makes an accidental dependency in the sim layer fail
loudly. Files needing a DOM opt in with `// @vitest-environment jsdom`. Coverage
scoped to `sim/` and `data/`; Phaser view classes need a live render context and
would only depress the number. Confirmed test files do not reach the bundle.

### [Phase 0 — Step 0.2 — Architecture audit] — 2026-08-04
Status: complete
Changed: `ARCHITECTURE.md` (new), `NOTES-FOR-HUMAN.md` (new)
Tests: none added
Needs tuning: none
Notes: Every "Stack facts" claim in the brief verified true. Four things it did not
anticipate, all logged: (1) `tsconfig` sets `erasableSyntaxOnly`, which bans `enum`
— fixed sets must be `const` objects with derived union types. (2) `money` and
`lives` are private fields on `UIScene`, so the economy lives in the view layer.
(3) A single leak crosses the scene boundary three times. (4) **Found a live bug:**
`Grid.worldToTile` imports demoMap's 23×14 bounds but map2 is 26×17, so 111 of
map2's 365 buildable tiles (30%) silently reject clicks. Not fixed — it changes
visible behaviour and is a real balance change. Recommended for early Phase 1.

### [Phase 0 — Step 0.3a — Pure simulation layer] — 2026-08-04
Status: complete
Changed: `src/game/sim/{entities,damage,economy,movement,leak,rng}.ts` + tests
Tests: 96 passing
Needs tuning: none
Notes: `movement.ts` and `leak.ts` are additions to the brief's list — the harness
cannot report leaks without simulating positions, and the wave-5 life-loss rule was
inlined twice in `BaseEnemy`. Both are rules, not rendering. Purity is enforced by
`purity.test.ts`, which scans via Vite's raw glob (avoiding an `@types/node`
dependency) and whose detector is unit-tested against 8 positive and 6 negative
cases. Verified the guard fires by temporarily importing Phaser into `economy.ts`.
Original quirks preserved deliberately: waypoint arrival consumes a tick without
moving, fast enemies overshoot, exact diagonals face sideways, `canAfford` keeps
its `balance > 0` clause. One test I wrote was genuinely wrong — it asserted a
fork could be seeded from its parent without consuming a draw, which is
impossible; corrected to the property that actually matters.

### [Phase 0 — Step 0.4 — Data-driven definitions] — 2026-08-04
Status: complete
Changed: `src/game/data/{towers,enemies,waves}.ts` + tests
Tests: 135 passing
Needs tuning: **tower damage — see below**
Notes: Done before the view wiring rather than after, so the Phaser classes get
rewired once against both layers instead of twice. Every value asserted against
what shipped. Two safe improvements: `getWaveComposition` returns fresh objects
(the original mutated shared config while accumulating, so a caller could corrupt
later waves), and definitions are frozen.

**Tower damage is now a per-tower field but all three are set to 3.** The brief
asks both for per-tower damage and for Phase 0 to change nothing visible;
differentiating breaks the second. Structure moved, numbers are the human's call.

### [Phase 0 — Step 0.3b — Thin views] — 2026-08-04
Status: complete
Changed: `BaseEnemy`, `Enemy`, `BaseTower`, `Towers`, `Projectile`, `TowerManager`,
`WaveManager`, `EnemySpawner`, `UIScene`, `GameScene`, `TowerSelection`
Tests: 136 passing
Needs tuning: none
Notes: Damage is a tower property now — each tower passes its own value to the
projectile it fires. One subtlety caught: the original's if/else could not reach
the animation code on a waypoint-arrival frame, so facing was never updated on
those ticks. Porting it naively made sprites flip at corners, because the arrival
direction derives from a sub-pixel delta. `MovementResult.advancedWaypoint` now
reports it, with a test. Casts removed where touched: `BaseEnemy.getPosition()`
replaced three `(target as any).visual` reads. Simulation state is named `sim`
because Phaser's `GameObject` owns a public `state` of an incompatible type.
Folded in Step 0.8's enemy renames (with deprecated aliases) since these files were
being rewritten anyway. Deprecated `static COST`/`COLOR` kept on tower classes
because `GameScene.old.ts` reads them and `tsc` compiles it.

### [Phase 0 — Step 0.5 — Typed event bus] — 2026-08-04
Status: complete
Changed: `src/game/events.ts` (new) + test, all emit/on call sites
Tests: 147 passing
Needs tuning: none
Notes: Wraps the same `scene.events` emitter; all five original names preserved
verbatim. Added `waveStarted`, `waveCleared`, `towerPlaced`, `towerUpgraded`,
`runEnded`, `enemyEscaped`. Four are emitted for real — a typed bus nobody uses
buys nothing. Verified the types bite by compiling a probe with a wrong payload
type, a misspelled name, and a mistyped handler; `tsc` rejected all three. Naming
is now mixed (kebab-case originals, camelCase additions) — flagged, not resolved
unilaterally.

### [Phase 0 — Step 0.6 — Seeded RNG] — 2026-08-04
Status: complete
Changed: `src/game/data/{seeds.ts,demoMap.ts,map2.ts}`, `MapRenderer.ts` + test
Tests: 158 passing
Needs tuning: default seed values (cosmetic)
Notes: **Deliberate behaviour change, flagged.** Map generation called
`Math.random()` at module load to choose twelve blocked tiles, so the playable
area differed every page load — gameplay randomness that could not be reproduced,
and incompatible with "same seed, same result". Maps are now stable. To restore
per-run variety while keeping runs reproducible, generate a seed at startup and
pass it in; the builders already accept one. Also replaced four instances of
`[...x].sort(() => Math.random() - 0.5)`, which is neither uniform nor
implementation-independent, with seeded Fisher-Yates.

### [Phase 0 — Step 0.7 — Headless harness] — 2026-08-04
Status: complete
Changed: `src/game/sim/harness.ts` (new) + test
Tests: 180 passing
Needs tuning: see Step 0.4 and NOTES-FOR-HUMAN.md
Notes: `simulateWave()` runs a wave on a fixed timestep with no Phaser and no wall
clock. Reuses the game's own modules and data, so there is no second rules
implementation to drift. Two documented divergences: one lane per run, and killed
enemies leave immediately rather than lingering through a death animation
(in-flight projectiles still arrive and are discarded, so overkill waste is
modelled). 21 tests including five-run determinism and full spawn accounting.

**First balance read, and it is significant:** with damage equal at 3, FastTower
strictly dominates at every wave on every metric. DPS is 6.0 / 3.0 / 2.0 for
fast / basic / long, so LongRangeTower costs 5× a BasicTower and deals two-thirds
its damage. There is currently no board state where building one is correct. Full
tables in NOTES-FOR-HUMAN.md.

### [Phase 0 — Step 0.8 — Cleanup] — 2026-08-04
Status: complete
Changed: (landed within 0.3b and 0.6)
Tests: 180 passing
Needs tuning: none
Notes: `console.log` gone from every hot path — `BaseEnemy.update` (which logged
per-frame per-enemy through ad-hoc `(this as any)` counters), `GameScene.update`,
the tower constructors, `EnemySpawner.spawnEnemy`, and per-tile map generation.
Load-time logging in `BootScene` and `PathFinder` left in place; it runs once and
the asset diagnostics are useful while sprite work continues. Enemy renames landed
in 0.3b with `CircleEnemy`/`SquareEnemy`/`TriangleEnemy` retained as deprecated
aliases for one phase.

### [Phase 0 — COMPLETE] — 2026-08-04
Status: **needs-human** — phase gate, per Section 3
Tests: 180 passing · `tsc --noEmit` clean · `npm run build` green
Needs tuning: tower damage (the blocking one), wave scaling, late-wave life loss,
tower caps, cost escalation, starting gold and lives
Notes: Every Phase 0 definition-of-done item is met except one that only a human
can close: **"Game plays exactly as before" has not been verified visually.** The
type checker, 180 tests, and the production build all pass, but nobody has watched
it run. That needs a person at a keyboard before Phase 1 starts.

**Do not begin Phase 1 without a decision on tower damage.** Phase 1's premise —
enemy properties that punish wrong tower choices — assumes towers are meaningfully
different. They currently are not.
