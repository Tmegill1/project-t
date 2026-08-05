/**
 * Headless wave simulation.
 *
 * Runs a wave to completion with no Phaser, no rendering, and no wall clock,
 * on a fixed timestep. This is what makes balance claims testable: a build
 * either clears a wave or it does not, and the answer is reproducible from a
 * seed rather than observed once by hand.
 *
 * Fidelity to the live game, and where it deliberately differs:
 *
 * - Spawn scheduling, movement, targeting, projectile travel, damage, and leak
 *   cost all use the same modules and data the game uses. There is no second
 *   implementation of the rules to drift out of step.
 * - One lane. The live game spawns each wave's composition once per spawn path;
 *   the harness simulates a single path, so a two-lane map is two runs.
 * - No death animation. A killed enemy leaves immediately rather than lingering
 *   untargetable for the length of its animation. Projectiles already in flight
 *   toward it still arrive and are discarded without dealing damage, which is
 *   what the live game does, so overkill waste is modelled.
 */

import { SPAWN_TIMING, getWaveComposition, getWaveModifiers, squareSpawnDelay } from "../data/waves";
import { resolveDamage } from "./damage";
import { resolveLeakPenalty } from "./leak";
import { advanceAlongPath } from "./movement";
import { effectiveSpeed } from "./entities";
import { createRng } from "./rng";
import { createEnemyState, createSplitChildren } from "./spawn";
import { selectTarget } from "./targeting";
import { emptyTiers, resolveTowerStats } from "./upgrades";
import { lieutenantFor } from "./lieutenants";
import { BOSS_DEFS, bossArchetypeFor } from "../data/bosses";
import {
  applyRegen,
  createBossRuntime,
  dueAdds,
  registerHit,
  speedMultiplierFor,
  suppressionMultiplierFor,
} from "./bosses";
import type { BossArchetype } from "../data/bosses";
import type { BossRuntime } from "./bosses";
import { currentModifiers, noModifiers } from "./powers";
import type { GlobalModifiers, PowerState } from "./powers";
import type { EnemyRole } from "./lieutenants";
import { DEFAULT_TARGETING_PRIORITY } from "./targeting";
import type { WaveEntry } from "../data/waves";
import type { EnemyProperty, EnemyState, PathPoint, TowerKind, Vec2 } from "./entities";
import type { TargetingPriority } from "./targeting";
import type { UpgradeTiers } from "./upgrades";

/** Matches Projectile's constant in the view layer. */
const PROJECTILE_SPEED = 500;

/** Matches Projectile's hit test in the view layer. */
const HIT_RADIUS = 5;

const DEFAULT_TIMESTEP_MS = 16;

/** Simulated milliseconds after which a wave is abandoned as stuck. */
const DEFAULT_MAX_DURATION_MS = 600_000;

export interface HarnessTower {
  kind: TowerKind;
  /** World position of the tower's centre. */
  position: Vec2;
  /** Purchased upgrade tiers. Defaults to an unupgraded tower. */
  upgrades?: UpgradeTiers;
  /** Defaults to the same "closest" rule towers used before priorities. */
  priority?: TargetingPriority;
}

export interface HarnessConfig {
  /** The lane enemies walk, in world pixels. */
  path: PathPoint[];
  /** Which wave to simulate. Selects difficulty scaling and the default
   *  composition. */
  wave: number;
  towers: HarnessTower[];
  /** Seed for every random decision. Identical seeds give identical results. */
  seed: number;
  /** Overrides the wave's normal composition, for testing a specific mix. */
  composition?: WaveEntry[];
  /**
   * Overrides each group's own properties, applying these to every enemy.
   * This is how a test isolates a single threat; leave it unset to simulate
   * the wave the player would actually face.
   */
  enemyProperties?: readonly EnemyProperty[];
  /** Simulation tick, in milliseconds. Defaults to 16 (~60fps). */
  timestepMs?: number;
  /** Simulated milliseconds before the run is abandoned. */
  maxDurationMs?: number;
  /**
   * Powers and command upgrades in force. Their modifiers apply throughout.
   * Omit for a run with no Insignia spent.
   */
  powers?: PowerState;
  /**
   * Whether the wave's lieutenant, if it has one, is included. Defaults to
   * true. Setting it false is how the decision test models "let it escape".
   */
  includeLieutenant?: boolean;
  /** Whether the wave's boss, if it has one, is included. Defaults to true. */
  includeBoss?: boolean;
  /** Forces a specific archetype regardless of the wave, for testing. */
  forceBossArchetype?: BossArchetype;
}

export interface WaveResult {
  /** Enemies that entered the lane. */
  spawned: number;
  /** Enemies that reached the exit. */
  leaked: number;
  killed: number;
  goldEarned: number;
  /** Phase 2 currency. Zero until lieutenants and bosses exist. */
  insigniaEarned: number;
  /** Simulated milliseconds the wave took. */
  timeElapsed: number;
  livesLost: number;
  /** Projectiles fired, for diagnosing a defence that never engaged. */
  shotsFired: number;
  /** Damage that landed. Overkill is excluded. */
  damageDealt: number;
  /** Enemies produced by splitters, included in `spawned`. */
  splitSpawns: number;
  /** Lieutenants that entered. */
  lieutenantsSpawned: number;
  /** Lieutenants killed before the exit. */
  lieutenantsKilled: number;
  /** Lieutenants that reached the exit. Costs zero lives, by design. */
  lieutenantsEscaped: number;
  /** Bosses that entered. */
  bossesSpawned: number;
  /** Bosses killed. */
  bossesKilled: number;
  /** Bosses that reached the exit. Unlike lieutenants, these cost lives. */
  bossesLeaked: number;
  /** Health a Bulwark regenerated. High means the wrong damage shape. */
  bossHealthRegenerated: number;
  /** Enemies a Broodmother spawned. */
  bossAddsSpawned: number;
  /** Tower-seconds lost to a Warden's aura. */
  towerSecondsSuppressed: number;
  /** Hits swallowed by shields. High means the wrong tower shape. */
  shieldedHits: number;
  /** Damage removed by armour. High means the wrong tower shape. */
  armorBlocked: number;
  /** Shots that found no legal target, e.g. phased enemies with no detection. */
  shotsWithoutTarget: number;
  /** True if the run hit its duration cap, meaning the result is unreliable. */
  timedOut: boolean;
}

interface SimTower {
  readonly kind: TowerKind;
  readonly position: Vec2;
  readonly range: number;
  readonly fireRate: number;
  readonly damage: number;
  readonly pierce: number;
  readonly splashRadius: number;
  readonly detection: boolean;
  readonly slowFactor: number;
  readonly slowDurationMs: number;
  readonly priority: TargetingPriority;
  lastFireTime: number;
}

interface SimProjectile {
  position: Vec2;
  targetId: number;
  damage: number;
  pierce: number;
  splashRadius: number;
  slowFactor: number;
  slowDurationMs: number;
}

interface ScheduledSpawn {
  atMs: number;
  kind: WaveEntry["kind"];
  properties: readonly EnemyProperty[];
  role: EnemyRole;
  healthMultiplier: number;
  extraSpeedMultiplier: number;
  goldMultiplier: number;
  insigniaReward: number;
  archetype?: BossArchetype;
}

/** The mutable simulation world a hit may affect. */
interface SimWorld {
  enemies: Map<number, EnemyState>;
  path: readonly PathPoint[];
  /** Allocates ids for enemies born mid-wave, so splitter children are unique. */
  nextId: () => number;
  /** Power and command modifiers in force at a given time. */
  modifiersAt: (nowMs: number) => GlobalModifiers;
  /** Per-boss mechanics state, keyed by enemy id. */
  bossRuntimes: Map<number, BossRuntime>;
}

/** Builds the spawn schedule, mirroring GameScene.startWave's staggering. */
function buildSchedule(
  composition: readonly WaveEntry[],
  override: readonly EnemyProperty[] | undefined,
  lieutenant: ReturnType<typeof lieutenantFor>,
  boss: { def: (typeof BOSS_DEFS)[BossArchetype]; archetype: BossArchetype } | null,
): ScheduledSpawn[] {
  const entryFor = (kind: WaveEntry["kind"]) => composition.find((e) => e.kind === kind);
  const countOf = (kind: WaveEntry["kind"]) => entryFor(kind)?.count ?? 0;

  const slimes = countOf("slime");
  const bees = countOf("bee");
  const ogres = countOf("ogre");

  const schedule: ScheduledSpawn[] = [];
  const push = (kind: WaveEntry["kind"], count: number, startMs: number) => {
    // An explicit override applies to everything, which is how a test isolates
    // one threat. Otherwise each group carries only its own properties, so a
    // wave is never uniformly immune to a build.
    const properties = override ?? entryFor(kind)?.properties ?? [];
    for (let i = 0; i < count; i++) {
      schedule.push({
        atMs: startMs + i * SPAWN_TIMING.intervalMs,
        kind,
        properties,
        role: "normal",
        healthMultiplier: 1,
        extraSpeedMultiplier: 1,
        goldMultiplier: 1,
        insigniaReward: 0,
      });
    }
  };

  push("slime", slimes, 0);
  push("bee", bees, SPAWN_TIMING.beeStartDelayMs);
  push("ogre", ogres, squareSpawnDelay(slimes));

  // The lieutenant and its escort arrive partway through, so the player faces
  // it while the ordinary wave is still on the board.
  if (lieutenant) {
    schedule.push({
      atMs: lieutenant.spawnDelayMs,
      kind: lieutenant.kind,
      properties: override ?? [],
      role: "lieutenant",
      healthMultiplier: lieutenant.healthMultiplier,
      extraSpeedMultiplier: lieutenant.speedMultiplier,
      goldMultiplier: lieutenant.goldMultiplier,
      insigniaReward: lieutenant.insigniaReward,
    });

    for (let i = 0; i < lieutenant.escortCount; i++) {
      schedule.push({
        atMs: lieutenant.spawnDelayMs + i * SPAWN_TIMING.intervalMs,
        kind: lieutenant.escortKind,
        properties: override ?? [],
        role: "normal",
        healthMultiplier: 1,
        extraSpeedMultiplier: 1,
        goldMultiplier: 1,
        insigniaReward: 0,
      });
    }
  }

  if (boss) {
    const def = boss.def;
    schedule.push({
      atMs: def.spawnDelayMs,
      kind: def.kind,
      properties: override ?? [],
      role: "boss",
      healthMultiplier: def.healthMultiplier,
      extraSpeedMultiplier: def.speedMultiplier,
      goldMultiplier: def.goldMultiplier,
      insigniaReward: def.insigniaReward,
      archetype: boss.archetype,
    });

    for (let i = 0; i < def.escortCount; i++) {
      schedule.push({
        atMs: def.spawnDelayMs + i * SPAWN_TIMING.intervalMs,
        kind: def.escortKind,
        properties: override ?? [],
        role: "normal",
        healthMultiplier: 1,
        extraSpeedMultiplier: 1,
        goldMultiplier: 1,
        insigniaReward: 0,
      });
    }
  }

  // Stable ordering: by time, then by the order pushed above, so the schedule
  // does not depend on the sort implementation.
  return schedule
    .map((spawn, index) => ({ spawn, index }))
    .sort((a, b) => a.spawn.atMs - b.spawn.atMs || a.index - b.index)
    .map(({ spawn }) => spawn);
}

/** Speed multiplier from the Accelerator's wounded-animal rule, if applicable. */
function bossSpeedMultiplier(
  enemy: EnemyState,
  runtimes: Map<number, BossRuntime>,
): number {
  const runtime = runtimes.get(enemy.id);
  return runtime ? speedMultiplierFor(runtime.archetype, enemy) : 1;
}

/** Strongest suppression affecting a tower from any Warden on the board. */
function wardenSuppression(
  towerPosition: Vec2,
  enemies: Map<number, EnemyState>,
  runtimes: Map<number, BossRuntime>,
): number {
  let worst = 1;
  for (const [bossId, runtime] of runtimes) {
    const boss = enemies.get(bossId);
    if (!boss) continue;
    worst = Math.max(
      worst,
      suppressionMultiplierFor(runtime.archetype, towerPosition, boss.position),
    );
  }
  return worst;
}

export function simulateWave(config: HarnessConfig): WaveResult {
  const timestep = config.timestepMs ?? DEFAULT_TIMESTEP_MS;
  const maxDuration = config.maxDurationMs ?? DEFAULT_MAX_DURATION_MS;
  const composition = config.composition ?? getWaveComposition(config.wave);
  const modifiers = getWaveModifiers(config.wave);

  // Created so future randomness (splitter direction, drop rolls) is seeded
  // from the start. Nothing in Phase 0 draws from it, which is why the current
  // results are seed-independent.
  const rng = createRng(config.seed);
  void rng;

  const lieutenant =
    (config.includeLieutenant ?? true) ? lieutenantFor(config.wave) : null;
  const bossArchetype =
    config.forceBossArchetype ??
    ((config.includeBoss ?? true) ? bossArchetypeFor(config.wave) : null);
  const bossEntry = bossArchetype
    ? { def: BOSS_DEFS[bossArchetype], archetype: bossArchetype }
    : null;

  const schedule = buildSchedule(composition, config.enemyProperties, lieutenant, bossEntry);

  /** Per-boss mutable mechanics state, keyed by enemy id. */
  const bossRuntimes = new Map<number, BossRuntime>();

  // Command upgrades never expire, so they are resolved once. Tactical effects
  // are re-resolved each tick because they do.
  const powers = config.powers;
  const modifiersAt = (nowMs: number): GlobalModifiers =>
    powers ? currentModifiers(powers, nowMs) : noModifiers();
  const baseModifiers = modifiersAt(0);
  const path = config.path;
  const spawnPoint = path[0] ?? { x: 0, y: 0 };

  const towers: SimTower[] = config.towers.map((tower) => {
    const stats = resolveTowerStats(tower.kind, tower.upgrades ?? emptyTiers());
    return {
      kind: tower.kind,
      position: { x: tower.position.x, y: tower.position.y },
      range: stats.range,
      fireRate: stats.fireRate,
      damage: stats.damage,
      pierce: stats.pierce,
      splashRadius: stats.splashRadius,
      detection: stats.detection,
      slowFactor: stats.slowFactor,
      slowDurationMs: stats.slowDurationMs,
      priority: tower.priority ?? DEFAULT_TARGETING_PRIORITY,
      // Negative infinity lets a tower fire the instant a target appears,
      // matching the live game where the clock is already far past zero.
      lastFireTime: Number.NEGATIVE_INFINITY,
    };
  });

  const enemies = new Map<number, EnemyState>();
  let projectiles: SimProjectile[] = [];

  let nextId = 1;
  const world: SimWorld = {
    enemies,
    path,
    nextId: () => nextId++,
    modifiersAt,
    bossRuntimes,
  };
  let scheduleIndex = 0;
  let now = 0;

  const result: WaveResult = {
    spawned: 0,
    leaked: 0,
    killed: 0,
    goldEarned: 0,
    insigniaEarned: 0,
    splitSpawns: 0,
    lieutenantsSpawned: 0,
    lieutenantsKilled: 0,
    lieutenantsEscaped: 0,
    bossesSpawned: 0,
    bossesKilled: 0,
    bossesLeaked: 0,
    bossHealthRegenerated: 0,
    bossAddsSpawned: 0,
    towerSecondsSuppressed: 0,
    shieldedHits: 0,
    armorBlocked: 0,
    shotsWithoutTarget: 0,
    timeElapsed: 0,
    livesLost: 0,
    shotsFired: 0,
    damageDealt: 0,
    timedOut: false,
  };

  while (now <= maxDuration) {
    // --- spawn -----------------------------------------------------------
    while (scheduleIndex < schedule.length && schedule[scheduleIndex].atMs <= now) {
      const scheduled = schedule[scheduleIndex];
      const enemy = createEnemyState({
        id: world.nextId(),
        kind: scheduled.kind,
        position: spawnPoint,
        path,
        wave: config.wave,
        speedModifier: modifiers.speedModifier,
        healthModifier: modifiers.healthModifier,
        properties: scheduled.properties,
        role: scheduled.role,
        healthMultiplier: scheduled.healthMultiplier,
        extraSpeedMultiplier: scheduled.extraSpeedMultiplier,
        goldMultiplier: scheduled.goldMultiplier,
        insigniaReward: Math.round(
          scheduled.insigniaReward * baseModifiers.insigniaMultiplier,
        ),
      });
      if (enemy.role === "lieutenant") result.lieutenantsSpawned++;
      if (enemy.role === "boss") {
        result.bossesSpawned++;
        if (scheduled.archetype) {
          bossRuntimes.set(enemy.id, createBossRuntime(scheduled.archetype, now));
        }
      }
      enemies.set(enemy.id, enemy);
      result.spawned++;
      scheduleIndex++;
    }

    // --- boss mechanics --------------------------------------------------
    for (const [bossId, runtime] of bossRuntimes) {
      const boss = enemies.get(bossId);
      if (!boss) {
        bossRuntimes.delete(bossId);
        continue;
      }

      // Bulwark: regenerates unless recently hit hard enough to count as
      // burst. A rapid-fire defence never suppresses it and never wins.
      const healed = applyRegen(runtime.archetype, boss, runtime, now, timestep);
      if (healed > boss.health) {
        result.bossHealthRegenerated += healed - boss.health;
        boss.health = healed;
      }

      // Broodmother: a continuous stream of adds, which is what punishes
      // single-target fire.
      const due = dueAdds(runtime.archetype, runtime, now);
      if (due) {
        bossRuntimes.set(bossId, due.runtime);
        for (let i = 0; i < due.adds.count; i++) {
          const add = createEnemyState({
            id: world.nextId(),
            kind: due.adds.kind,
            position: boss.position,
            path,
            wave: config.wave,
            speedModifier: modifiers.speedModifier,
            healthModifier: modifiers.healthModifier,
            pathIndexOverride: boss.pathIndex,
          });
          enemies.set(add.id, add);
          result.spawned++;
          result.bossAddsSpawned++;
        }
      }
    }

    // --- move enemies ----------------------------------------------------
    for (const enemy of [...enemies.values()]) {
      const step = advanceAlongPath(
        { position: enemy.position, pathIndex: enemy.pathIndex },
        path,
        effectiveSpeed(enemy, now) *
          modifiersAt(now).enemySpeedMultiplier *
          bossSpeedMultiplier(enemy, bossRuntimes),
        timestep,
      );
      enemy.pathIndex = step.pathIndex;

      if (step.reachedGoal) {
        result.leaked++;
        // resolveLeakPenalty honours the lieutenant exemption, so this is zero
        // for them however much health they escaped with.
        result.livesLost += resolveLeakPenalty(enemy, config.wave);
        if (enemy.role === "lieutenant") result.lieutenantsEscaped++;
        // Unlike a lieutenant, a boss that gets through costs lives —
        // resolveLeakPenalty already charges it, since it is not exempt.
        if (enemy.role === "boss") result.bossesLeaked++;
        enemies.delete(enemy.id);
        continue;
      }

      enemy.position = step.position;
    }

    // --- towers fire -----------------------------------------------------
    for (const tower of towers) {
      // Warden: towers caught inside the aura fire far slower, which is what
      // punishes a defence packed into one killzone.
      const suppression = wardenSuppression(tower.position, enemies, bossRuntimes);
      if (suppression > 1) {
        result.towerSecondsSuppressed += timestep / 1000;
      }
      if (now - tower.lastFireTime < tower.fireRate * suppression) continue;

      const active = modifiersAt(now);
      const target = selectTarget(
        // Sensor Net grants detection to every tower, so it is applied here
        // rather than baked into the tower's own stats.
        active.globalDetection ? { ...tower, detection: true } : tower,
        enemies.values(),
      );
      if (!target) {
        // Counted so a defence blinded by phasing is visible in the result
        // rather than looking like a defence that simply underperformed.
        if (enemies.size > 0) result.shotsWithoutTarget++;
        continue;
      }

      projectiles.push({
        position: { x: tower.position.x, y: tower.position.y },
        targetId: target.id,
        damage: Math.round(tower.damage * active.damageMultiplier),
        pierce: tower.pierce + active.bonusPierce,
        splashRadius: tower.splashRadius,
        slowFactor: tower.slowFactor,
        slowDurationMs: tower.slowDurationMs,
      });
      tower.lastFireTime = now;
      result.shotsFired++;
    }

    // --- projectiles -----------------------------------------------------
    const surviving: SimProjectile[] = [];
    for (const projectile of projectiles) {
      const target = enemies.get(projectile.targetId);
      if (!target) continue; // Target already gone; the shot is wasted.

      const dx = target.position.x - projectile.position.x;
      const dy = target.position.y - projectile.position.y;
      const distance = Math.hypot(dx, dy);

      if (distance < HIT_RADIUS) {
        applyHit(projectile, target, world, result, now);
        // Splash catches everything else within the radius, which is what
        // makes the sustained branch the answer to splitters.
        if (projectile.splashRadius > 0) {
          for (const bystander of [...enemies.values()]) {
            if (bystander.id === target.id) continue;
            const spread = Math.hypot(
              bystander.position.x - target.position.x,
              bystander.position.y - target.position.y,
            );
            if (spread <= projectile.splashRadius) {
              applyHit(projectile, bystander, world, result, now);
            }
          }
        }
        continue; // Projectile is consumed either way.
      }

      const travel = (PROJECTILE_SPEED * timestep) / 1000;
      projectile.position = {
        x: projectile.position.x + (dx / distance) * travel,
        y: projectile.position.y + (dy / distance) * travel,
      };
      surviving.push(projectile);
    }
    projectiles = surviving;

    // --- termination -----------------------------------------------------
    const everythingSpawned = scheduleIndex >= schedule.length;
    if (everythingSpawned && enemies.size === 0) {
      break;
    }

    now += timestep;
  }

  if (now > maxDuration) {
    result.timedOut = true;
  }

  result.timeElapsed = now;
  return result;
}

/**
 * Applies one projectile's effect to one enemy, handling shields, armour,
 * slowing, death, and splitting.
 *
 * Mutates `enemies` and `result` — the simulation loop owns both, and threading
 * an immutable world through every hit would cost more than it buys here.
 */
function applyHit(
  projectile: SimProjectile,
  target: EnemyState,
  world: SimWorld,
  result: WaveResult,
  now: number,
): void {
  const { enemies } = world;
  const hit = resolveDamage({ damage: projectile.damage, pierce: projectile.pierce }, target);

  target.health = hit.remainingHealth;
  target.shield = hit.remainingShield;

  // Bulwark: a hard enough hit stops it healing for a while.
  const runtime = world.bossRuntimes.get(target.id);
  if (runtime) {
    world.bossRuntimes.set(
      target.id,
      registerHit(runtime.archetype, runtime, hit.damageDealt, target.maxHealth, now),
    );
  }
  result.damageDealt += hit.damageDealt;
  result.armorBlocked += hit.armorAbsorbed;
  if (hit.shieldAbsorbed) result.shieldedHits++;

  // A slow lands even when a shield swallows the damage: it is a separate
  // effect of being hit, and that is what makes rapid fire good into swiftness.
  if (projectile.slowFactor < 1) {
    target.slowedUntilMs = Math.max(target.slowedUntilMs, now + projectile.slowDurationMs);
    target.slowFactor = Math.min(target.slowFactor, projectile.slowFactor);
  }

  if (!hit.lethal) return;

  target.alive = false;
  result.killed++;
  result.goldEarned += Math.round(target.reward * world.modifiersAt(now).goldMultiplier);
  // Insignia comes only from lieutenants and bosses; ordinary enemies carry
  // zero, so this cannot leak into the ordinary kill loop.
  result.insigniaEarned += target.insigniaReward;
  if (target.role === "lieutenant") result.lieutenantsKilled++;
  if (target.role === "boss") result.bossesKilled++;
  enemies.delete(target.id);

  for (const child of createSplitChildren(target, world.nextId, world.path)) {
    enemies.set(child.id, child);
    result.spawned++;
    result.splitSpawns++;
  }
}
