# Architecture

Audit of `td-browser` as of Phase 0, Step 0.2 (branch `feat/strategic-depth`, base
commit `8fef6ed`). This describes the code **as it exists today**, before the
logic/rendering separation in Step 0.3. It is a map of the territory, not a
statement of intent — where the current design is a problem, this document says so.

`src/scenes/GameScene.old.ts` (1,464 lines) is dead code and is excluded from every
description below. See [NOTES-FOR-HUMAN.md](./NOTES-FOR-HUMAN.md).

---

## 1. Stack

| Layer | Choice |
|---|---|
| Engine | Phaser 3.90 (`Phaser.AUTO` — WebGL with Canvas fallback) |
| Language | TypeScript 5.9, `strict`, `noEmit` |
| Bundler | Vite 7 |
| Tests | Vitest 4 (added Step 0.1), default environment `node` |
| Backend | Cloudflare Worker + D1, in `worker/` |

### tsconfig constraints that shape the design

Three settings are load-bearing and constrain how new code must be written:

- **`erasableSyntaxOnly: true`** — no `enum`, no constructor parameter properties,
  no `namespace`. Anything that needs a runtime representation must be written as a
  `const` object plus a derived union type:
  ```ts
  export const DamageKind = { Physical: "physical", Pierce: "pierce" } as const;
  export type DamageKind = (typeof DamageKind)[keyof typeof DamageKind];
  ```
- **`verbatimModuleSyntax: true`** — type-only imports must use `import type`.
- **`noUnusedLocals` / `noUnusedParameters`** — unused parameters must be prefixed
  with `_`.

`include` is `["src"]`, so **every file under `src/` is type-checked**, including
test files and the dead `GameScene.old.ts`. That last point matters: renaming the
enemy classes in Step 0.8 would break `tsc` unless deprecated aliases are retained,
because `GameScene.old.ts` imports `CircleEnemy`, `SquareEnemy`, and `TriangleEnemy`.

---

## 2. Scene graph and boot order

Registered in `src/main.ts`:

```
BootScene → LoginScene → RegisterScene → MainMenu → GameScene ⇄ UIScene
```

`GameScene` and `UIScene` run **concurrently**: `GameScene` is started and `UIScene`
is `launch`ed alongside it. They are separate Phaser scenes with separate event
emitters, and they talk to each other constantly (§5).

`BootScene` (283 lines) loads every asset up front — the background, the map sprite
sheet, tower sprites, and 18 enemy sprite sheets (3 creatures × 3 directions ×
walk/death). It then slices the map sheet manually and registers animations.

Canvas size is derived from `demoMap`'s dimensions at module load
(`GRID_COLS * TILE_SIZE`). Switching to map2 calls `this.scale.resize(...)` plus
`this.scale.refresh()` at runtime.

---

## 3. Module inventory

### Pure — no Phaser import, testable today

| Module | Role |
|---|---|
| `game/data/demoMap.ts` | `TILE_SIZE`/`GRID_COLS`/`GRID_ROWS` + generated `TileKind[][]` |
| `game/data/map2.ts` | Same, larger board (26×17) |
| `game/map/PathFinder.ts` | BFS spawn→goal pathfinding over `TileKind[][]` |
| `game/map/Grid.ts` | Tile ↔ world-pixel conversion |
| `game/managers/WaveManager.ts` | Wave composition + difficulty modifiers |
| `utils/validation.ts` | Form validation helpers |

`WaveManager` is the only gameplay-rules module that is already Phaser-free. It is
the model for what Step 0.3 produces.

Both map modules call `Math.random()` at module scope to scatter decorations, so
they are pure in the "no Phaser" sense but **not deterministic** (§7).

### Phaser-coupled — cannot be instantiated without a live scene

| Module | Coupling |
|---|---|
| `sprites/enemies/BaseEnemy.ts` | `extends Phaser.GameObjects.GameObject` |
| `sprites/enemies/Enemy.ts` | Concrete enemies; build sprites in constructor |
| `sprites/towers/BaseTower.ts` | `extends Phaser.GameObjects.Container` |
| `sprites/towers/Towers.ts` | Concrete towers; build sprites in constructor |
| `sprites/towers/Projectile.ts` | `extends Phaser.GameObjects.Arc` |
| `managers/EnemySpawner.ts` | Holds `Scene` + `Group`, calls `scene.add` |
| `managers/TowerManager.ts` | Holds `Scene` + `Group` |
| `systems/MapRenderer.ts` | Pure rendering |
| `scenes/*`, `ui/*`, `game/ui/*` | Scenes and widgets |

**This is the central problem Phase 0 exists to solve.** Every balance rule —
damage, rewards, life loss, targeting — lives inside a class that requires a
running WebGL context to construct. No balance test can be written against the
current code.

---

## 4. Where state lives

State is **fragmented across four owners with no single source of truth.**

| State | Owner | Notes |
|---|---|---|
| `money` | `UIScene` (private) | 100 on demoMap, 250 on map2 |
| `lives` | `UIScene` (private) | Starts at 20 |
| `wave` (**display**) | `UIScene` (private) | Set via `setWave()` |
| `currentWave` (**authoritative**) | `GameScene` (private) | Duplicated with the above |
| `isWaveActive`, `enemiesRemainingInWave` | `GameScene` | |
| `isGameOver`, `isPaused`, `hasGameStarted` | `GameScene` | |
| Tower counts per type | `TowerManager` | Drives cost escalation + limits |
| Enemy health / path index | Each `BaseEnemy` instance | |
| Tower cooldown / current target | Each `BaseTower` instance | |
| Live object sets | Three `Phaser.GameObjects.Group`s on `GameScene` | |

Two consequences worth calling out:

1. **The economy lives in the view layer.** `money` is a private field on a
   `Phaser.Scene` subclass, mutated by `addMoney()` and a `purchase-tower` handler.
   Step 0.3's `sim/economy.ts` must therefore be pure functions that `UIScene`
   delegates to — the currency total cannot simply be lifted out without changing
   behaviour, which Phase 0 forbids.
2. **Wave number is stored twice**, in `GameScene.currentWave` and `UIScene.wave`,
   kept in sync only by an explicit `setWave()` call.

---

## 5. Data flow

### Tower placement

```
UIScene.TowerSelection (click)
  └─ gameScene.events.emit("tower-selected", towerType)
       └─ GameScene.selectedTowerType = towerType
            └─ GameScene.handleTowerPlacement(pointer)
                 ├─ worldToTile()            → bounds check
                 ├─ towerManager.canPlaceTower()  → tile is "buildable", unoccupied
                 ├─ towerManager.isTowerAtLimit() → per-type hard cap
                 ├─ uiScene.canAfford(cost)       → cost = BASE + count * escalation
                 ├─ towerManager.placeTower()     → new Tower(scene, col, row)
                 └─ uiScene.events.emit("purchase-tower", cost) → money -= cost
```

### Combat

```
GameScene.update(time, delta)
  ├─ enemies.children  → BaseEnemy.update()   → advance along path
  ├─ towers.children   → BaseTower.update()   → findTarget() + shoot()
  └─ projectiles.children → Projectile.update() → move; on hit, takeDamage()
```

`BaseTower.shoot()` constructs a `Projectile` and registers it by reaching through
the scene: `(this.sceneRef as any).projectiles.add(projectile)`. That property is
attached by `GameScene.create()` with `(this as any).projectiles = this.projectiles`.

**Damage today is a single hardcoded constant.** `Projectile.damage = 3`
(`Projectile.ts:7`), and `BaseEnemy.takeDamage()` is `this.health -= damage`. Damage
is a property of the *projectile*, not the tower, so all three towers deal identical
damage and differ only in range and fire rate.

### Death and leak

```
BaseEnemy.takeDamage() → health <= 0
  └─ scene.events.emit("enemy-killed", reward)
       └─ GameScene handler → uiScene.addMoney(reward)   [direct call, not an event]

BaseEnemy.update() → path exhausted
  └─ scene.events.emit("enemy-reached-goal", lifeLoss)
       └─ GameScene handler → re-emits onto UIScene's emitter
            └─ UIScene handler → lives -= lifeLoss
                 └─ if lives <= 0 → gameScene.events.emit("game-over")
                      └─ GameScene.showGameOverMenu()
```

A single leak crosses the scene boundary **three times**. Note also that
`lifeLoss` is not constant: past wave 5, `BaseEnemy.update()` substitutes the
enemy's *remaining health* for its base life loss. Phase 2's lieutenants — which
must cost zero lives on escape — need an explicit exemption from this path.

---

## 6. The event bus

Phaser's per-scene `EventEmitter` (`scene.events`). There are **two independent
emitters**, one per scene, and code emits onto whichever it can reach.

| Event | Emitted by | Handled by | Payload |
|---|---|---|---|
| `enemy-killed` | `BaseEnemy` (Game) | `GameScene` | `reward: number` |
| `enemy-reached-goal` | `BaseEnemy` (Game) | `GameScene` → re-emit to UI | `lifeLoss: number` |
| `enemy-reached-goal` | `GameScene` (UI) | `UIScene` | `lifeLoss: number` |
| `game-over` | `UIScene` (Game) | `GameScene` | — |
| `tower-selected` | `UIScene` (Game) | `GameScene` | `TowerType \| null` |
| `purchase-tower` | `GameScene` (UI) | `UIScene` | `cost: number` |
| `check-tower-cost` | *(never emitted)* | `UIScene` | `cost, callback` |

`check-tower-cost` has a live listener and no emitter — dead code.

Every payload is untyped: handlers annotate their own parameters, and nothing
verifies that emitter and listener agree. Step 0.5 adds a typed wrapper over this
same emitter rather than replacing it.

---

## 7. Randomness

`Math.random()` appears in 8 places, **all of them cosmetic**: decoration scatter in
`demoMap.ts`, `map2.ts`, and `MapRenderer.ts`. No gameplay rule is currently random.

Two implications for Step 0.6:

- Introducing seeded RNG is mostly about the randomness that Phases 1–3 will add
  (drop rates, spawn jitter, splitter direction), not about replacing existing calls.
- The map decoration calls run **at module scope**, so map layout differs between
  page loads and cannot be reproduced. Routing them through a seeded RNG is what
  makes the Step 0.7 harness reproducible.

---

## 8. GameScene dependency sketch

`GameScene` (849 lines) is the hub. Everything flows through it.

```
                         ┌──────────────┐
                         │  GameScene   │
                         └──────┬───────┘
        ┌───────────────┬───────┼────────┬───────────────┐
        ▼               ▼       ▼        ▼               ▼
   MapRenderer    WaveManager  Groups  TowerManager  GameMenu
        │              │      (3×)         │         GameOverMenu
        │              ▼         │         ▼         Congratulations
        │        (pure, no    ┌──┴──┐   Towers.ts    SellButton
        │         Phaser)     │     │       │        StartButton
        ▼                     ▼     ▼       ▼
   map data              BaseEnemy Projectile BaseTower
        │                     │     │         │
        └─────────────────────┴─────┴─────────┘
                              │
                    all require a live Scene
                              │
                      ┌───────┴────────┐
                      │    UIScene     │  ← money, lives
                      └────────────────┘
                       (reads GameScene privates via `as any`)
```

`GameScene`'s responsibilities, all in one class: map selection and canvas resizing,
group ownership, input handling (hover, click, placement, selection, ESC), tower
placement validation, tower selling, wave scheduling, wave-completion detection,
game-over and victory flow, scene transitions, and debug text.

### Type-safety escape hatches

The `as any` casts are not stylistic — they are the seams where the architecture
does not hold together:

| Location | Cast | What it works around |
|---|---|---|
| `GameScene.ts:109` | `(this as any).projectiles = …` | Towers need the projectile group but have no reference to it |
| `BaseTower.ts:84,102,122` | `(target as any).visual` | `BaseEnemy.visual` is `protected`; towers need its position |
| `Projectile.ts:28` | `(this.target as any).visual` | Same |
| `BaseTower.ts:125` | `(this.sceneRef as any).projectiles` | Same as the first row |
| `UIScene.ts:104,113` | `(gameScene as any).towerManager`, `.mapRenderer` | UI reads GameScene's private managers |
| `BaseEnemy.ts:290-297` | `(this as any)._updateCount` | Ad-hoc debug counters |
| `TowerManager.ts:102` | `(towerType as any).COST` | Static property access through a constructor type |

`BaseEnemy` has no public position accessor, which is why three separate call sites
cast to reach `.visual`. Giving it one removes four casts.

---

## 9. Known landmines

Things that are surprising, fragile, or wrong. Items marked **(bug)** are
behavioural defects, not merely awkward code; all are logged in
[NOTES-FOR-HUMAN.md](./NOTES-FOR-HUMAN.md).

1. **(bug) `Grid.worldToTile` hardcodes demoMap's bounds.** It imports `GRID_COLS`
   (23) and `GRID_ROWS` (14) from `demoMap`, but map2 is 26×17. On map2, **111 of
   365 buildable tiles (30%) report `inBounds: false`** and silently reject every
   click — the entire right and bottom band is unusable. `TILE_SIZE` is 48 in both
   maps, so coordinate conversion itself is currently correct by coincidence.

2. **`enemiesRemainingInWave` counts spawns, not survivors.** It is initialised to
   the wave total and decremented inside each spawn callback, so it reaches zero
   when the last enemy *spawns*. Wave completion actually depends on the
   `enemies.children.size === 0` half of the condition. The name describes something
   the variable does not do.

3. **Wave completion is detected in two places** — a polling `time.addEvent` loop
   (`startWaveCompletionCheck`) and an inline check in `update()`. Both call
   `onWaveComplete()`.

4. **Spawn scheduling is `time.delayedCall` per enemy per path**, computed as fixed
   offsets when the wave starts. It is tied to Phaser's clock and cannot be stepped
   by a headless harness — Step 0.7 needs its own fixed-timestep scheduler.

5. **`console.log` in hot paths.** `BaseEnemy.update()` logs for the first five
   frames *per enemy* via `(this as any)._updateCount`, and every tower constructor
   logs its texture lookup. With 30+ enemies this is hundreds of console writes per
   wave.

6. **Inconsistent constant sourcing.** `TILE_SIZE` is imported from `demoMap` in
   `Grid`, `MapRenderer`, `Enemy`, and `MainMenu`, but from `map2` in `Towers` and
   `UIScene`. Same value today (48), so it is latent rather than active.

7. **`check-tower-cost` is a listener with no emitter.**

8. **Progression is gated by cost escalation and hard caps.** `TowerManager` charges
   `BASE + count × escalation` (20 / 30 / 100 per additional tower) and enforces
   limits of 5 / 5 / 3, raised by 2 on map2. Phase 1 upgrades must explicitly decide
   whether to replace or coexist with this.

---

## 10. What Step 0.3 changes

Target shape, for reference while reading the steps that follow:

```
src/game/sim/         pure TypeScript, zero Phaser imports (test-enforced)
  entities.ts         plain data types for enemy/tower instance state
  damage.ts           resolveDamage(source, target, context) → DamageResult
  economy.ts          currency math
  rng.ts              seeded RNG
  harness.ts          headless fixed-timestep wave runner

src/game/data/        stats as data, no logic
  towers.ts  enemies.ts  waves.ts

src/game/events.ts    typed map over the existing scene.events emitter
```

Phaser classes become thin views: they own sprites, animation, and input, and
delegate every rule to `sim/`. `BaseEnemy.takeDamage()` calls `resolveDamage`
instead of doing arithmetic.

**Phase 0 changes no visible behaviour.** Every value moved into `data/` keeps the
number it has today, including ones that are probably wrong.
