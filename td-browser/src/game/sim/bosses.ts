/**
 * Boss mechanics, as pure functions over state.
 *
 * Each archetype's rule lives here so the harness and the live game apply the
 * same one, and so "does this boss actually punish that build" is a question a
 * test can answer.
 */

import { BOSS_DEFS } from "../data/bosses";
import type { BossArchetype, BossMechanics } from "../data/bosses";
import type { EnemyState } from "./entities";

/** Per-boss mutable state the simulation carries alongside the enemy. */
export interface BossRuntime {
  archetype: BossArchetype;
  /** Timestamp until which regeneration is suppressed by a burst hit. */
  regenSuppressedUntilMs: number;
  /** Timestamp the next batch of adds is due. */
  nextAddAtMs: number;
}

export function createBossRuntime(archetype: BossArchetype, nowMs: number): BossRuntime {
  const mechanics = BOSS_DEFS[archetype].mechanics;
  return {
    archetype,
    regenSuppressedUntilMs: 0,
    nextAddAtMs: mechanics.addIntervalMs ? nowMs + mechanics.addIntervalMs : Infinity,
  };
}

export function mechanicsFor(archetype: BossArchetype): BossMechanics {
  return BOSS_DEFS[archetype].mechanics;
}

/**
 * Whether a hit counts as burst for regeneration purposes.
 *
 * Expressed as a fraction of maximum health so it scales with the boss rather
 * than needing a separate number per archetype.
 */
export function isBurstHit(
  archetype: BossArchetype,
  damageDealt: number,
  maxHealth: number,
): boolean {
  const threshold = mechanicsFor(archetype).burstThresholdFraction;
  if (!threshold || maxHealth <= 0) return false;
  return damageDealt >= maxHealth * threshold;
}

/**
 * Applies regeneration for one tick.
 *
 * Returns the boss's new health. A rapid-fire defence that never lands a big
 * enough hit will see this cancel out its damage entirely, which is the point:
 * the Bulwark is a wall to sustained fire and paper to burst.
 */
export function applyRegen(
  archetype: BossArchetype,
  boss: Pick<EnemyState, "health" | "maxHealth">,
  runtime: BossRuntime,
  nowMs: number,
  deltaMs: number,
): number {
  const regen = mechanicsFor(archetype).regenPerSecond;
  if (!regen || boss.health <= 0) return boss.health;
  if (nowMs < runtime.regenSuppressedUntilMs) return boss.health;

  return Math.min(boss.maxHealth, boss.health + (regen * deltaMs) / 1000);
}

/** Records a hit, suppressing regeneration if it was hard enough. */
export function registerHit(
  archetype: BossArchetype,
  runtime: BossRuntime,
  damageDealt: number,
  maxHealth: number,
  nowMs: number,
): BossRuntime {
  if (!isBurstHit(archetype, damageDealt, maxHealth)) return runtime;

  const suppression = mechanicsFor(archetype).regenSuppressionMs ?? 0;
  return {
    ...runtime,
    regenSuppressedUntilMs: Math.max(runtime.regenSuppressedUntilMs, nowMs + suppression),
  };
}

/**
 * Speed multiplier from the Accelerator's wounded-animal rule.
 *
 * Interpolates from 1 at full health to `speedAtZeroHealth` at zero, so
 * chipping it down without finishing the job makes the problem worse.
 */
export function speedMultiplierFor(
  archetype: BossArchetype,
  boss: Pick<EnemyState, "health" | "maxHealth">,
): number {
  const atZero = mechanicsFor(archetype).speedAtZeroHealth;
  if (!atZero || boss.maxHealth <= 0) return 1;

  const remaining = Math.max(0, Math.min(1, boss.health / boss.maxHealth));
  return 1 + (atZero - 1) * (1 - remaining);
}

/**
 * How much a tower's fire rate is multiplied by the Warden's aura.
 *
 * Returns 1 when unaffected. Distance is measured to the boss, so a defence
 * spread along the lane loses only the towers it happens to be passing.
 */
export function suppressionMultiplierFor(
  archetype: BossArchetype,
  towerPosition: { x: number; y: number },
  bossPosition: { x: number; y: number },
): number {
  const mechanics = mechanicsFor(archetype);
  if (!mechanics.suppressionRadius || !mechanics.suppressionFireRateMultiplier) return 1;

  const distance = Math.hypot(
    towerPosition.x - bossPosition.x,
    towerPosition.y - bossPosition.y,
  );
  return distance <= mechanics.suppressionRadius ? mechanics.suppressionFireRateMultiplier : 1;
}

export interface AddSpawnRequest {
  kind: NonNullable<BossMechanics["addKind"]>;
  count: number;
}

/**
 * Adds due at this moment, and the advanced runtime.
 *
 * Returns null when nothing is due, so the caller does no work on most ticks.
 */
export function dueAdds(
  archetype: BossArchetype,
  runtime: BossRuntime,
  nowMs: number,
): { adds: AddSpawnRequest; runtime: BossRuntime } | null {
  const mechanics = mechanicsFor(archetype);
  if (!mechanics.addIntervalMs || !mechanics.addKind || nowMs < runtime.nextAddAtMs) {
    return null;
  }

  return {
    adds: { kind: mechanics.addKind, count: mechanics.addCount ?? 1 },
    runtime: { ...runtime, nextAddAtMs: nowMs + mechanics.addIntervalMs },
  };
}
