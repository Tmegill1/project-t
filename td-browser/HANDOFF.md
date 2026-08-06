# Handoff — read this first

State of the project, what was learned building it, and what to do next.
Written 2026-08-06, after phases 0–4, a tuning pass, and a cleanup pass, all
merged to `main`.

Companion documents:
- **[NOTES-FOR-HUMAN.md](./NOTES-FOR-HUMAN.md)** — every balance value needing a
  verdict, and every finding logged during the build. The tuning tables live
  there, not here.
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — structure, state ownership, data flow.
- **[AGENT-BUILD-PLAN.md](./AGENT-BUILD-PLAN.md)** — the original spec and the
  per-step progress log.

---

## 1. Where things stand

**On `main`:** 615 tests passing, `tsc --noEmit` clean, `npm run build` green.

| Phase | Shipped |
|---|---|
| 0 | Simulation split from rendering; `sim/` is Phaser-free and test-enforced; data-driven stats; typed event bus; seeded RNG; **headless harness** |
| 1 | 5 composable enemy properties; 2 upgrade branches × 4 tiers with cross-path gating; per-tower targeting |
| 2 | Three currencies; lieutenants (escape costs zero lives); 4 powers + 4 command upgrades; touch-first power bar |
| 3 | 4 boss archetypes; call-wave-early; capped interest; economy in one file |
| 4 | Versioned save on localStorage behind a swappable store; passive ceiling enforced in code; run summary |
| — | Tuning pass, 4th tower (Mortar), 3rd map, audio, cleanup |

**Content:** 4 towers, 5 enemy properties, 4 boss archetypes, 8 powers/commands,
3 maps, 22 sounds. Victory at wave 20; bosses at 5/10/15/20.

### The one thing that has never happened

**Almost none of this has been playtested.** The systems are tested; the *feel*
is not. Every balance number is a placeholder. That is the single most important
fact about this project's state.

---

## 2. Working environment

- **Work in `~/project-t`** (WSL-local clone), *not* the OneDrive checkout at
  `/mnt/c/Users/Tyler/OneDrive/Documents/GitHub/project-t`. The OneDrive copy's
  `node_modules` holds Windows rollup binaries and `npm run build` fails from
  WSL. `git remote` already points at GitHub.
- **Dev server:** `cd ~/project-t/td-browser && npx vite --host 0.0.0.0 --port 5173`.
  Reachable from Windows at `localhost:5173`; the WSL IP fallback changes on
  every WSL restart, so read it fresh with `hostname -I`.
- **Verify with all three**, always: `npx vitest run`, `npx tsc --noEmit`,
  `npm run build`. The last one catches things the first two do not.

### tsconfig constraints that bite

- `erasableSyntaxOnly` — **no `enum`, no constructor parameter properties.**
  Use `const` objects with derived union types. This has caught me more than once.
- `verbatimModuleSyntax` — type-only imports need `import type`.
- `noUnusedLocals` / `noUnusedParameters` — prefix intentional ones with `_`.

---

## 3. Key learnings

These are the things that were not obvious and cost real time to discover.

### The harness is the point

`sim/harness.ts` runs a wave headlessly on a fixed timestep with no Phaser. It
reuses the game's own modules, so there is no second rules implementation to
drift. **Every balance claim in this project is a test, not an assertion.** When
adding a system, add it to the harness first — that is what makes the next
question answerable.

### Measure the thing the player feels, not the thing that is easy

The boss test originally asked *"did the boss die"*. A heavy burst build killed
all four archetypes **and still lost four hundred lives doing it**, because its
towers were busy with the boss while the wave walked past. The metric rated it
the best build. It now measures each boss's **marginal cost in lives** against
the same wave without it.

Same lesson elsewhere: the lieutenant decision turned out not to be "kill it or
not" but **"retarget onto it or not"** — with default targeting no board can
kill one.

### Prefer relative test thresholds where the curve moves

An absolute life threshold needed recalibrating every time difficulty changed,
and a build sitting at 28 against a cut-off of 30 made the suite a coin flip.
Comparative claims ("no build answers all four") survive tuning; absolute ones
do not.

### Free tiers are not free

The cross-path rule hands every tower **two free tiers of its off-branch**. My
first upgrade tables put detection and pierce at tier 2, so every build got the
counters for nothing. **Anything at tier 1 or 2 is effectively free to everyone.**
Counters must sit at tier 3+.

### Content you cannot reach does not exist

At `MAX_WAVES = 10`, a standard run showed **2 of 5 enemy properties and 1 of 4
bosses**. Three-quarters of two phases were unreachable. Check reachability
whenever a schedule or a cap changes.

### Unbounded penalties destroy measurement

The leak penalty scaled with enemy health, which compounds every wave. By wave
10 a single leaked ogre cost 12 of 20 lives; by wave 20, all of them. Lives were
a binary, not a resource — and **every balance number was unreadable**, because
a near-miss and a disaster both reported as catastrophe. Capping it at 4 fixed
the measurement as much as the game.

### Progression gates can read as bugs

Gating towers behind Seals meant a new player opened the build menu, found one
option, and reasonably concluded the game was broken. **Sell options the player
won't miss (powers, passives); never gate the basic verbs.**

### Verify assets against the asset

`towers.png` is 480×384 with sprites on a 96px grid; the loader declared 100×100.
Neither dimension divides by 100, so every frame after the first straddled its
neighbour. Found by decoding the PNG and locating the transparent gutters — not
by reading the config. **When something looks subtly wrong visually, measure the
file.**

### Phaser specifics

- `GameObject.state` already exists (`string | number`). Simulation state on
  `BaseEnemy` is named `sim` because of this collision.
- `setFrame` resets a sprite's display size — reassert it or towers jump to 96px.
- Audio needs an explicit unlock on first gesture or the first sounds vanish
  silently. This is the most common way audio "doesn't work".

---

## 4. What to do next

In priority order.

### ★ 1. Playtest and tune. Do this before building anything else.

Nothing else on this list matters as much. Every number is a guess. The specific
values I would touch first:

| Value | Where | Why first |
|---|---|---|
| Tower budget (16/20/18) | `data/maps.ts` | Strongest difficulty lever; asks a question rather than inflating a stat |
| Seals per run vs catalogue | `sim/currencies.ts`, `data/metaUpgrades.ts` | Sets progression pace; currently ~9 runs to buy everything |
| Mortar stats | `data/towers.ts` | Newest and least exercised; area towers are easy to mis-tune |
| Boss health multipliers | `data/bosses.ts` | Retuned twice already, never played |

A modelled run currently reaches **wave 16 of 20** before dying to phased
enemies. That model buys towers greedily and is not a real player.

### 2. Replace the placeholder audio

`public/audio/*.wav` are synthesised and crude. The system is done — swapping a
file is a filename change. Kenney.nl publishes CC0 packs needing no attribution.
Listen for whether tower firing is too present with eight towers up; that is the
mix I would least trust.

### 3. Split `GameScene.ts`

1,096 lines doing map selection, input handling, placement validation, wave
scheduling, and scene transitions. A real improvement, but a structural change
with genuine regression risk — do it deliberately, not as a side effect.

### 4. Load size, before any portal submission

- Bundle is 1.34 MB (368 KB gzipped), almost all Phaser. Code-splitting would help.
- `public/map-sprites.png` is 3.9 MB — sliced manually at runtime. Compressing it
  or pre-slicing into an atlas is the biggest single win available.

### Deliberately not done

- **Phase 5 (hero unit)** — optional in the spec and explicitly requires approval.
  The spec's own scope-discipline section argues against it before the game is fun.
- **D1 save sync** — localStorage sits behind a `SaveStore` interface, so adding a
  D1 implementation is an afternoon. Revisit when there is a leaderboard, or when
  players ask for cross-device.
- **A fifth tower** — the sprite sheet's 16 usable frames are fully spent on four.

---

## 5. Landmines still in the code

- `enemiesRemainingInWave` counts **spawns, not survivors**. It works because the
  `enemies.size === 0` clause does the real work. The name lies.
- **Wave completion is detected in two places** — a polling timer and an inline
  check in `update()`. The timer is not destroyed when the inline path wins.
- The **`W` hotkey jumps to the final wave.** Useful for testing, but it now skips
  four bosses and would be found instantly by a portal player. Remove before release.
- `getWaveComposition` accumulates waves 1..N rather than replacing, so wave 3
  contains waves 1 and 2. Original behaviour, preserved deliberately — surprising
  when reading the tables.

---

## 6. Conventions worth keeping

- **Tests state the design claim, not the implementation.** `bossCounterplay`,
  `counterplay` and `lieutenantDecision` exist to catch the *game* breaking, not
  the code. If one fails after a tuning change, the numbers drifted — that is the
  test doing its job.
- **Never weaken a test to make it pass.** Several were wrong during this build
  and were corrected with the reasoning written down. That is different from
  loosening one.
- Balance values live in `data/`, rules in `sim/`, rendering in `sprites/` and
  `ui/`. `sim/` must never import Phaser — a test enforces it.
- Commit at green checkpoints with the reasoning in the message, not just the what.
