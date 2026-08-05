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
   * Properties applied to every enemy in the wave. This is how a build is
   * tested against a specific threat.
   */
  enemyProperties?: readonly EnemyProperty[];
  /** Simulation tick, in milliseconds. Defaults to 16 (~60fps). */
  timestepMs?: number;
  /** Simulated milliseconds before the run is abandoned. */
  maxDurationMs?: number;
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
  entry: WaveEntry["kind"];
}

/** The mutable simulation world a hit may affect. */
interface SimWorld {
  enemies: Map<number, EnemyState>;
  path: readonly PathPoint[];
  /** Allocates ids for enemies born mid-wave, so splitter children are unique. */
  nextId: () => number;
}

/** Builds the spawn schedule, mirroring GameScene.startWave's staggering. */
function buildSchedule(composition: readonly WaveEntry[]): ScheduledSpawn[] {
  const countOf = (kind: WaveEntry["kind"]) =>
    composition.find((e) => e.kind === kind)?.count ?? 0;

  const slimes = countOf("slime");
  const bees = countOf("bee");
  const ogres = countOf("ogre");

  const schedule: ScheduledSpawn[] = [];
  const push = (kind: WaveEntry["kind"], count: number, startMs: number) => {
    for (let i = 0; i < count; i++) {
      schedule.push({ atMs: startMs + i * SPAWN_TIMING.intervalMs, entry: kind });
    }
  };

  push("slime", slimes, 0);
  push("bee", bees, SPAWN_TIMING.beeStartDelayMs);
  push("ogre", ogres, squareSpawnDelay(slimes));

  // Stable ordering: by time, then by the order pushed above, so the schedule
  // does not depend on the sort implementation.
  return schedule
    .map((spawn, index) => ({ spawn, index }))
    .sort((a, b) => a.spawn.atMs - b.spawn.atMs || a.index - b.index)
    .map(({ spawn }) => spawn);
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

  const schedule = buildSchedule(composition);
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
  const world: SimWorld = { enemies, path, nextId: () => nextId++ };
  let scheduleIndex = 0;
  let now = 0;

  const result: WaveResult = {
    spawned: 0,
    leaked: 0,
    killed: 0,
    goldEarned: 0,
    insigniaEarned: 0,
    splitSpawns: 0,
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
      const enemy = createEnemyState({
        id: world.nextId(),
        kind: schedule[scheduleIndex].entry,
        position: spawnPoint,
        path,
        wave: config.wave,
        speedModifier: modifiers.speedModifier,
        healthModifier: modifiers.healthModifier,
        properties: config.enemyProperties ?? [],
      });
      enemies.set(enemy.id, enemy);
      result.spawned++;
      scheduleIndex++;
    }

    // --- move enemies ----------------------------------------------------
    for (const enemy of [...enemies.values()]) {
      const step = advanceAlongPath(
        { position: enemy.position, pathIndex: enemy.pathIndex },
        path,
        effectiveSpeed(enemy, now),
        timestep,
      );
      enemy.pathIndex = step.pathIndex;

      if (step.reachedGoal) {
        result.leaked++;
        result.livesLost += resolveLeakPenalty(enemy, config.wave);
        enemies.delete(enemy.id);
        continue;
      }

      enemy.position = step.position;
    }

    // --- towers fire -----------------------------------------------------
    for (const tower of towers) {
      if (now - tower.lastFireTime < tower.fireRate) continue;

      const target = selectTarget(tower, enemies.values());
      if (!target) {
        // Counted so a defence blinded by phasing is visible in the result
        // rather than looking like a defence that simply underperformed.
        if (enemies.size > 0) result.shotsWithoutTarget++;
        continue;
      }

      projectiles.push({
        position: { x: tower.position.x, y: tower.position.y },
        targetId: target.id,
        damage: tower.damage,
        pierce: tower.pierce,
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
  result.goldEarned += target.reward;
  enemies.delete(target.id);

  for (const child of createSplitChildren(target, world.nextId, world.path)) {
    enemies.set(child.id, child);
    result.spawned++;
    result.splitSpawns++;
  }
}
