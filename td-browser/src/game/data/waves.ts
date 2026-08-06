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
import type { EnemyProperty } from "../sim/properties";

export interface WaveEntry {
  kind: EnemyKind;
  count: number;
  /** Properties every enemy in this group carries. */
  properties?: readonly EnemyProperty[];
}

/**
 * Wave at which the player wins the map.
 *
 * Raised from 10 to 20 for content visibility. At 10, a standard run showed
 * two of five enemy properties and one of four boss archetypes — swift,
 * splitter, phased, the Warden, the Broodmother and the Accelerator were all
 * unreachable in normal play. Twenty waves, with the schedules below, means
 * every property and every archetype is seen, and the run ends on a boss.
 */
export const MAX_WAVES = 20;

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

/**
 * Added once per wave beyond the last authored one.
 *
 * Halved from 5/10/3. The original added eighteen enemies *every wave*
 * forever, on top of compounding health — so wave 20 fielded nearly three
 * hundred enemies in a single lane. At that count it stops mattering whether
 * the player brought the right counter; sheer volume decides the wave, and the
 * property system becomes irrelevant exactly where it should be most
 * interesting. Health scaling now carries more of the difficulty.
 */
const ENDLESS_BUNDLE: readonly WaveEntry[] = Object.freeze([
  { kind: "slime", count: 2 },
  { kind: "bee", count: 5 },
  { kind: "ogre", count: 2 },
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
 * When each enemy property first appears.
 *
 * ⚠ NEEDS TUNING — see NOTES-FOR-HUMAN.md.
 *
 * The ordering is not arbitrary. A property that arrives before the player can
 * afford its counter is a wall, not a decision — and phasing is the sharpest
 * case, because a defence with no detection kills literally none of it. So
 * phasing arrives late, well after gold exists to reach a tier-3 Marksman, and
 * it is never applied to a whole wave at once (see `propertiesFor`).
 */
export const PROPERTY_INTRODUCTION: Readonly<Record<EnemyProperty, number>> = Object.freeze({
  /** Rapid fire stops working. Countered by heavy hits or pierce. */
  armored: 4,
  /** Heavy hits start being wasted. Countered by rapid cheap fire. */
  shielded: 6,
  /** Pressures the back of the lane. Countered by slows. */
  swift: 8,
  /** Punishes single-target fire. Countered by splash. */
  splitter: 11,
  /**
   * Hard-gates on detection, so it still arrives last — but now with seven
   * waves left to matter rather than five past the end of the game.
   */
  phased: 13,
});

/**
 * Which enemy kind carries a property when it is introduced.
 *
 * Spreading properties across kinds means a wave is never uniformly immune to
 * a build: the phased group is one kind among several, so a player without
 * detection leaks that group rather than losing the whole wave.
 */
const PROPERTY_CARRIER: Readonly<Record<EnemyProperty, EnemyKind>> = Object.freeze({
  armored: "ogre",
  shielded: "slime",
  swift: "bee",
  splitter: "ogre",
  phased: "bee",
});

/** Properties a given enemy kind carries at a given wave. */
export function propertiesFor(kind: EnemyKind, waveNumber: number): EnemyProperty[] {
  const properties: EnemyProperty[] = [];
  for (const [property, introducedAt] of Object.entries(PROPERTY_INTRODUCTION)) {
    const typed = property as EnemyProperty;
    if (waveNumber >= introducedAt && PROPERTY_CARRIER[typed] === kind) {
      properties.push(typed);
    }
  }
  return properties;
}

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

  // Properties are attached last, so they apply to the accumulated totals
  // rather than to whichever wave slice happened to introduce the kind.
  for (const entry of composition) {
    const properties = propertiesFor(entry.kind, waveNumber);
    if (properties.length > 0) entry.properties = properties;
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
