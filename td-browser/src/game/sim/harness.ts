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

import { getTowerDef } from "../data/towers";
import { SPAWN_TIMING, getWaveComposition, getWaveModifiers, squareSpawnDelay } from "../data/waves";
import { getEnemyDef, scaledHealth, scaledSpeed } from "../data/enemies";
import { resolveDamage } from "./damage";
import { resolveLeakPenalty } from "./leak";
import { advanceAlongPath, startingPathIndex } from "./movement";
import { createRng } from "./rng";
import type { WaveEntry } from "../data/waves";
import type { EnemyState, PathPoint, TowerKind, Vec2 } from "./entities";

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
  /** True if the run hit its duration cap, meaning the result is unreliable. */
  timedOut: boolean;
}

interface SimTower {
  readonly kind: TowerKind;
  readonly position: Vec2;
  readonly range: number;
  readonly fireRate: number;
  readonly damage: number;
  lastFireTime: number;
}

interface SimProjectile {
  position: Vec2;
  targetId: number;
  damage: number;
}

interface ScheduledSpawn {
  atMs: number;
  entry: WaveEntry["kind"];
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
    const def = getTowerDef(tower.kind);
    return {
      kind: tower.kind,
      position: { x: tower.position.x, y: tower.position.y },
      range: def.range,
      fireRate: def.fireRate,
      damage: def.damage,
      // Negative infinity lets a tower fire the instant a target appears,
      // matching the live game where the clock is already far past zero.
      lastFireTime: Number.NEGATIVE_INFINITY,
    };
  });

  const enemies = new Map<number, EnemyState>();
  let projectiles: SimProjectile[] = [];

  let nextId = 1;
  let scheduleIndex = 0;
  let now = 0;

  const result: WaveResult = {
    spawned: 0,
    leaked: 0,
    killed: 0,
    goldEarned: 0,
    insigniaEarned: 0,
    timeElapsed: 0,
    livesLost: 0,
    shotsFired: 0,
    damageDealt: 0,
    timedOut: false,
  };

  while (now <= maxDuration) {
    // --- spawn -----------------------------------------------------------
    while (scheduleIndex < schedule.length && schedule[scheduleIndex].atMs <= now) {
      const kind = schedule[scheduleIndex].entry;
      const def = getEnemyDef(kind);
      const health = scaledHealth(kind, modifiers.healthModifier);
      const id = nextId++;

      enemies.set(id, {
        id,
        kind,
        position: { x: spawnPoint.x, y: spawnPoint.y },
        pathIndex: startingPathIndex(spawnPoint, path),
        health,
        maxHealth: health,
        speed: scaledSpeed(kind, modifiers.speedModifier),
        reward: def.reward,
        lifeLoss: def.lifeLoss,
        wave: config.wave,
        alive: true,
        dying: false,
      });

      result.spawned++;
      scheduleIndex++;
    }

    // --- move enemies ----------------------------------------------------
    for (const enemy of [...enemies.values()]) {
      const step = advanceAlongPath(
        { position: enemy.position, pathIndex: enemy.pathIndex },
        path,
        enemy.speed,
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

      const target = findTarget(tower, enemies);
      if (!target) continue;

      projectiles.push({
        position: { x: tower.position.x, y: tower.position.y },
        targetId: target.id,
        damage: tower.damage,
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
        const hit = resolveDamage({ damage: projectile.damage }, target);
        target.health = hit.remainingHealth;
        result.damageDealt += hit.damageDealt;

        if (hit.lethal) {
          target.alive = false;
          result.killed++;
          result.goldEarned += target.reward;
          enemies.delete(target.id);
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

/** Nearest living enemy in range, matching BaseTower.findTarget. */
function findTarget(tower: SimTower, enemies: Map<number, EnemyState>): EnemyState | null {
  let closest: EnemyState | null = null;
  let closestDistance = tower.range;

  for (const enemy of enemies.values()) {
    if (!enemy.alive || enemy.dying) continue;

    const distance = Math.hypot(
      enemy.position.x - tower.position.x,
      enemy.position.y - tower.position.y,
    );
    if (distance <= tower.range && distance < closestDistance) {
      closestDistance = distance;
      closest = enemy;
    }
  }

  return closest;
}
