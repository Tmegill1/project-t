/**
 * Boss archetypes.
 *
 * One arrives roughly every ten waves, and they rotate. Each is built to
 * punish a *different* build, so a player who has settled into one answer is
 * forced to move:
 *
 *   Bulwark      heals unless burst down       -> punishes low per-hit damage
 *   Warden       suppresses towers near it     -> punishes clustered defences
 *   Broodmother  spawns adds continuously      -> punishes single-target fire
 *   Accelerator  speeds up as it is hurt       -> punishes slow damage output
 *
 * Unlike lieutenants, **bosses cost lives on leak.** A lieutenant is an
 * optional prize; a boss is a threat. `costsLivesOnLeak` in sim/lieutenants.ts
 * already draws that line.
 *
 * ⚠ Every number here is a placeholder needing playtesting.
 * See NOTES-FOR-HUMAN.md.
 */

import type { EnemyKind } from "../sim/entities";

export type BossArchetype = "bulwark" | "warden" | "broodmother" | "accelerator";

export const BOSS_ARCHETYPES = [
  "bulwark",
  "warden",
  "broodmother",
  "accelerator",
] as const satisfies readonly BossArchetype[];

/** Waves between boss appearances. */
export const BOSS_INTERVAL = 10;

/** First wave a boss can appear on. */
export const FIRST_BOSS_WAVE = 10;

export interface BossMechanics {
  /**
   * Health regained per second while it has not taken a big enough hit
   * recently. Zero disables it.
   */
  regenPerSecond?: number;
  /**
   * A hit at or above this fraction of the boss's maximum health counts as
   * "burst" and suppresses regeneration for `regenSuppressionMs`.
   */
  burstThresholdFraction?: number;
  regenSuppressionMs?: number;

  /** Towers within this radius are suppressed. Zero disables it. */
  suppressionRadius?: number;
  /** Multiplies the fire rate of suppressed towers. Above 1 is slower. */
  suppressionFireRateMultiplier?: number;

  /** Milliseconds between spawning adds. Zero disables it. */
  addIntervalMs?: number;
  addKind?: EnemyKind;
  addCount?: number;

  /**
   * Speed multiplier at zero health, interpolated from 1 at full health.
   * Above 1 means it accelerates as it is hurt.
   */
  speedAtZeroHealth?: number;
}

export interface BossDef {
  label: string;
  /** Shown to the player when it arrives. Must say what it punishes. */
  warning: string;
  kind: EnemyKind;
  healthMultiplier: number;
  speedMultiplier: number;
  goldMultiplier: number;
  insigniaReward: number;
  /** Escorts arriving with it. */
  escortKind: EnemyKind;
  escortCount: number;
  spawnDelayMs: number;
  mechanics: BossMechanics;
}

export const BOSS_DEFS: Readonly<Record<BossArchetype, BossDef>> = Object.freeze({
  // Answered by heavy single hits. A rapid-fire wall never out-damages the
  // regeneration, however much total damage per second it puts out.
  bulwark: {
    label: "Bulwark",
    warning: "Bulwark — regenerates unless hit hard. Bring heavy single shots.",
    kind: "ogre",
    healthMultiplier: 30,
    speedMultiplier: 0.6,
    goldMultiplier: 8,
    insigniaReward: 8,
    escortKind: "slime",
    escortCount: 6,
    spawnDelayMs: 8000,
    mechanics: {
      regenPerSecond: 14,
      burstThresholdFraction: 0.03,
      regenSuppressionMs: 2500,
    },
  },

  // Answered by spreading out. A defence packed into one killzone loses most
  // of its output whenever the Warden walks through it.
  warden: {
    label: "Warden",
    warning: "Warden — suppresses nearby towers. Spread your defence out.",
    kind: "ogre",
    healthMultiplier: 12,
    speedMultiplier: 0.8,
    goldMultiplier: 8,
    insigniaReward: 8,
    escortKind: "bee",
    escortCount: 8,
    spawnDelayMs: 8000,
    mechanics: {
      suppressionRadius: 170,
      suppressionFireRateMultiplier: 2.2,
    },
  },

  // Answered by splash. Single-target fire cannot keep up with the stream of
  // adds while also working through the boss itself.
  broodmother: {
    label: "Broodmother",
    warning: "Broodmother — spawns endlessly. Bring area damage.",
    kind: "ogre",
    healthMultiplier: 30,
    speedMultiplier: 0.7,
    goldMultiplier: 8,
    insigniaReward: 8,
    escortKind: "slime",
    escortCount: 4,
    spawnDelayMs: 8000,
    mechanics: {
      addIntervalMs: 1200,
      addKind: "bee",
      addCount: 3,
    },
  },

  // Answered by raw damage, or by slows. A defence that chips it down slowly
  // simply cannot finish before it outruns the lane.
  accelerator: {
    label: "Accelerator",
    warning: "Accelerator — faster the more it is hurt. Kill it quickly or slow it.",
    kind: "ogre",
    healthMultiplier: 16,
    speedMultiplier: 0.9,
    goldMultiplier: 8,
    insigniaReward: 8,
    escortKind: "bee",
    escortCount: 6,
    spawnDelayMs: 8000,
    mechanics: {
      speedAtZeroHealth: 4,
    },
  },
});

/** Whether a boss arrives during a wave. */
export function hasBoss(waveNumber: number): boolean {
  if (waveNumber < FIRST_BOSS_WAVE) return false;
  return (waveNumber - FIRST_BOSS_WAVE) % BOSS_INTERVAL === 0;
}

/**
 * Which archetype a wave carries, rotating through them in order.
 *
 * Rotation matters: a player who beat wave 10 with a burst build must not meet
 * the same boss at wave 20, or the archetypes stop asking new questions.
 */
export function bossArchetypeFor(waveNumber: number): BossArchetype | null {
  if (!hasBoss(waveNumber)) return null;
  const index = Math.floor((waveNumber - FIRST_BOSS_WAVE) / BOSS_INTERVAL);
  return BOSS_ARCHETYPES[index % BOSS_ARCHETYPES.length];
}

/** The boss definition for a wave, or null. */
export function bossFor(waveNumber: number): BossDef | null {
  const archetype = bossArchetypeFor(waveNumber);
  return archetype ? BOSS_DEFS[archetype] : null;
}
