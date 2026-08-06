import { getWaveComposition, getWaveModifiers } from "../data/waves";
import type { WaveEntry } from "../data/waves";
import type { EnemyKind } from "../sim/entities";

export type { WaveEntry };

export interface WaveConfig {
  spawns: WaveEntry[];
  total: number;
}

/**
 * Reads wave composition and difficulty scaling out of src/game/data/waves.ts.
 *
 * The numbers used to live here as a literal map; this class now only shapes
 * them for callers.
 */
export class WaveManager {
  getWaveConfig(waveNumber: number): WaveConfig {
    const spawns = getWaveComposition(waveNumber);
    return {
      spawns,
      total: spawns.reduce((sum, entry) => sum + entry.count, 0),
    };
  }

  calculateModifiers(waveNumber: number): { healthModifier: number; speedModifier: number } {
    return getWaveModifiers(waveNumber);
  }

  /** How many of one kind a wave contains. */
  countOf(waveNumber: number, kind: EnemyKind): number {
    return this.getWaveConfig(waveNumber).spawns.find((s) => s.kind === kind)?.count ?? 0;
  }
}
