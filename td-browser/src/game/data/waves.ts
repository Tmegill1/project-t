/**
 * Wave composition, difficulty scaling, and spawn scheduling.
 *
 * Replaces the `waveConfigs` map and `calculateModifiers` arithmetic in
 * WaveManager, plus the spawn-delay constants that were inline in
 * GameScene.startWave.
 *
 * The old vocabulary named enemies for shapes; the mapping is
 * circle -> slime, triangle -> bee, square -> ogre.
 */

import type { EnemyKind } from "../sim/entities";

export interface WaveEntry {
  kind: EnemyKind;
  count: number;
}

/** Waves at which the player wins the map. Matches GameScene's `maxWaves`. */
export const MAX_WAVES = 10;

/**
 * What each wave *adds*.
 *
 * Note the accumulation rule below: a wave's composition is the sum of this
 * table from wave 1 up to it, so wave 3 contains waves 1 and 2 as well. That
 * is how the game has always behaved.
 */
const WAVE_ADDITIONS: Readonly<Record<number, readonly WaveEntry[]>> = Object.freeze({
  1: [{ kind: "slime", count: 5 }],
  2: [
    { kind: "slime", count: 3 },
    { kind: "bee", count: 3 },
  ],
  3: [
    { kind: "slime", count: 3 },
    { kind: "bee", count: 3 },
  ],
  4: [{ kind: "ogre", count: 2 }],
  5: [
    { kind: "slime", count: 3 },
    { kind: "bee", count: 3 },
    { kind: "ogre", count: 1 },
  ],
});

/** Last wave with a hand-authored composition. Beyond it, waves grow by a
 *  fixed bundle. */
const LAST_AUTHORED_WAVE = 5;

/** Added once per wave beyond the last authored one. */
const ENDLESS_BUNDLE: readonly WaveEntry[] = Object.freeze([
  { kind: "slime", count: 5 },
  { kind: "bee", count: 10 },
  { kind: "ogre", count: 3 },
]);

/**
 * ⚠ NEEDS TUNING — see NOTES-FOR-HUMAN.md. These compound linearly forever,
 * so wave 30 enemies carry 3.5x health. Preserved exactly as they were.
 */
export const WAVE_SCALING = Object.freeze({
  healthPerWave: 0.1,
  speedPerWave: 0.05,
});

/** Timing constants lifted from GameScene.startWave. */
export const SPAWN_TIMING = Object.freeze({
  /** Gap between consecutive spawns of the same kind. */
  intervalMs: 500,
  /** Bees hold back this long before their column starts. */
  beeStartDelayMs: 5000,
  /** Ogres follow the last slime by this much... */
  ogreDelayAfterLastSlimeMs: 3000,
  /** ...but never start later than this. */
  ogreMaxStartDelayMs: 10000,
});

/**
 * Enemy counts for a wave, accumulated from wave 1.
 *
 * Returns fresh objects on every call — the original mutated shared config
 * objects while accumulating, so one caller could corrupt later waves.
 */
export function getWaveComposition(waveNumber: number): WaveEntry[] {
  const composition: WaveEntry[] = [];

  const add = (entry: WaveEntry): void => {
    const existing = composition.find((e) => e.kind === entry.kind);
    if (existing) {
      existing.count += entry.count;
    } else {
      composition.push({ kind: entry.kind, count: entry.count });
    }
  };

  const authoredThrough = Math.min(waveNumber, LAST_AUTHORED_WAVE);
  for (let wave = 1; wave <= authoredThrough; wave++) {
    for (const entry of WAVE_ADDITIONS[wave] ?? []) add(entry);
  }

  const endlessWaves = Math.max(0, waveNumber - LAST_AUTHORED_WAVE);
  for (let i = 0; i < endlessWaves; i++) {
    for (const entry of ENDLESS_BUNDLE) add(entry);
  }

  return composition;
}

export interface WaveModifiers {
  healthModifier: number;
  speedModifier: number;
}

/** Health and speed multipliers for a wave. Both are 1 through wave 5. */
export function getWaveModifiers(waveNumber: number): WaveModifiers {
  const wavesPast = Math.max(0, waveNumber - LAST_AUTHORED_WAVE);
  return {
    healthModifier: 1 + wavesPast * WAVE_SCALING.healthPerWave,
    speedModifier: 1 + wavesPast * WAVE_SCALING.speedPerWave,
  };
}

/**
 * When the ogre column starts, given how many slimes precede it.
 *
 * Ogres trail the last slime by three seconds, but never wait more than ten —
 * otherwise long slime columns in late waves would delay them indefinitely.
 */
export function squareSpawnDelay(slimeCount: number): number {
  const lastSlimeAt = (slimeCount - 1) * SPAWN_TIMING.intervalMs;
  return Math.min(
    lastSlimeAt + SPAWN_TIMING.ogreDelayAfterLastSlimeMs,
    SPAWN_TIMING.ogreMaxStartDelayMs,
  );
}
