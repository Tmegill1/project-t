/**
 * Lieutenants: optional, high-value targets that arrive mid-wave with an escort.
 *
 * The rule that defines them: **reaching the exit costs the player nothing.**
 * A lieutenant that gets through simply leaves with its Insignia. It is pure
 * opportunity cost, never punishment.
 *
 * That is not a detail — it is the whole mechanic. If letting one escape cost
 * lives, killing it would always be correct and the "decision" would be a
 * chore with extra steps. Because escaping is free, the player gets a real
 * question every few waves: is the Insignia worth the towers, the attention,
 * and the escort I have to survive to earn it?
 *
 * `lieutenantDecision.test.ts` exists to keep that question genuine.
 */

import { hasBoss } from "../data/bosses";
import type { EnemyKind } from "./entities";

/** What an enemy is, for rules that treat them differently. */
export type EnemyRole = "normal" | "lieutenant" | "boss";

/**
 * Waves between lieutenant appearances.
 *
 * Three, so the decision comes round often enough to be a habit rather than a
 * curiosity — and so a player who declines one is not waiting ten waves for
 * another chance.
 */
export const LIEUTENANT_INTERVAL = 3;

/** First wave one can appear on. */
export const FIRST_LIEUTENANT_WAVE = 3;

/**
 * ⚠ NEEDS TUNING — see NOTES-FOR-HUMAN.md.
 *
 * The Insignia payout is the lever that makes the decision close. Too high and
 * killing one is always right; too low and it is never worth the towers.
 */
export const LIEUTENANT_STATS = Object.freeze({
  /** Health multiplier over the base enemy it is built from. */
  healthMultiplier: 12,
  /** Slower than its escort — it is a wall, not a racer. */
  speedMultiplier: 0.75,
  /** Insignia paid on death. */
  insigniaReward: 3,
  /** Gold paid on death, on top of the Insignia. */
  goldMultiplier: 4,
  /** Extra escorts spawned alongside it. */
  escortCount: 6,
  /** Insignia the player forfeits by letting it through. Always the full
   *  reward: escaping costs the prize, nothing more. */
  insigniaIfEscaped: 0,
});

/** Which enemy a lieutenant is built from at a given wave. */
const LIEUTENANT_KIND: EnemyKind = "ogre";

/** What escorts it. */
const ESCORT_KIND: EnemyKind = "bee";

/**
 * Whether a lieutenant appears during a wave.
 *
 * Never on a boss wave. A boss is already a full wave's worth of decision, and
 * stacking an optional side objective on top would make the choice about
 * survival rather than about value — which is the opposite of the point.
 */
export function hasLieutenant(waveNumber: number): boolean {
  if (waveNumber < FIRST_LIEUTENANT_WAVE) return false;
  if (hasBoss(waveNumber)) return false;
  return (waveNumber - FIRST_LIEUTENANT_WAVE) % LIEUTENANT_INTERVAL === 0;
}

/** The next wave at or after `waveNumber` that carries a lieutenant. */
export function nextLieutenantWave(waveNumber: number): number {
  let wave = Math.max(waveNumber, FIRST_LIEUTENANT_WAVE);
  // Bounded: boss waves are skipped, so a naive loop could in principle run
  // away if the two schedules ever aligned badly.
  for (let guard = 0; guard < 1000; guard++) {
    if (hasLieutenant(wave)) return wave;
    wave++;
  }
  return wave;
}

export interface LieutenantSpawn {
  kind: EnemyKind;
  escortKind: EnemyKind;
  escortCount: number;
  healthMultiplier: number;
  speedMultiplier: number;
  insigniaReward: number;
  goldMultiplier: number;
  /** When it enters, relative to the start of the wave. */
  spawnDelayMs: number;
}

/**
 * The lieutenant for a wave, or null.
 *
 * It arrives partway through rather than at the start, so the player faces it
 * while the ordinary wave is still on the board — that overlap is what makes
 * committing towers to it a real cost.
 */
export function lieutenantFor(waveNumber: number): LieutenantSpawn | null {
  if (!hasLieutenant(waveNumber)) return null;

  return {
    kind: LIEUTENANT_KIND,
    escortKind: ESCORT_KIND,
    escortCount: LIEUTENANT_STATS.escortCount,
    healthMultiplier: LIEUTENANT_STATS.healthMultiplier,
    speedMultiplier: LIEUTENANT_STATS.speedMultiplier,
    insigniaReward: LIEUTENANT_STATS.insigniaReward,
    goldMultiplier: LIEUTENANT_STATS.goldMultiplier,
    spawnDelayMs: 6000,
  };
}

/**
 * Lives lost when an enemy of this role reaches the exit.
 *
 * Lieutenants are exempt. Bosses are not — Phase 3 leans on that difference.
 */
export function costsLivesOnLeak(role: EnemyRole): boolean {
  return role !== "lieutenant";
}
