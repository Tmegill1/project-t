import { describe, expect, it } from "vitest";
import {
  MAX_WAVES,
  SPAWN_TIMING,
  WAVE_SCALING,
  getWaveComposition,
  getWaveModifiers,
  squareSpawnDelay,
} from "./waves";

/** Total enemies in a composition, summed across kinds. */
function total(composition: ReturnType<typeof getWaveComposition>): number {
  return composition.reduce((sum, entry) => sum + entry.count, 0);
}

/** Count of one kind in a composition. */
function countOf(
  composition: ReturnType<typeof getWaveComposition>,
  kind: "slime" | "ogre" | "bee",
): number {
  return composition.find((entry) => entry.kind === kind)?.count ?? 0;
}

describe("getWaveComposition", () => {
  // WaveManager accumulates waves 1..N rather than replacing, so each wave
  // contains everything the previous ones did. These totals are what the game
  // produced before extraction and must not drift.
  //
  // The old vocabulary mapped circle -> slime, triangle -> bee, square -> ogre.
  describe("waves 1 to 5 accumulate", () => {
    it("wave 1", () => {
      const w = getWaveComposition(1);
      expect(countOf(w, "slime")).toBe(5);
      expect(total(w)).toBe(5);
    });

    it("wave 2", () => {
      const w = getWaveComposition(2);
      expect(countOf(w, "slime")).toBe(8);
      expect(countOf(w, "bee")).toBe(3);
      expect(total(w)).toBe(11);
    });

    it("wave 3", () => {
      const w = getWaveComposition(3);
      expect(countOf(w, "slime")).toBe(11);
      expect(countOf(w, "bee")).toBe(6);
      expect(total(w)).toBe(17);
    });

    it("wave 4 introduces ogres", () => {
      const w = getWaveComposition(4);
      expect(countOf(w, "slime")).toBe(11);
      expect(countOf(w, "bee")).toBe(6);
      expect(countOf(w, "ogre")).toBe(2);
      expect(total(w)).toBe(19);
    });

    it("wave 5", () => {
      const w = getWaveComposition(5);
      expect(countOf(w, "slime")).toBe(14);
      expect(countOf(w, "bee")).toBe(9);
      expect(countOf(w, "ogre")).toBe(3);
      expect(total(w)).toBe(26);
    });
  });

  describe("past wave 5", () => {
    it("adds one extra bundle per wave beyond the fifth", () => {
      const w6 = getWaveComposition(6);
      expect(countOf(w6, "slime")).toBe(14 + 5);
      expect(countOf(w6, "bee")).toBe(9 + 10);
      expect(countOf(w6, "ogre")).toBe(3 + 3);
    });

    it("stacks bundles linearly", () => {
      const w8 = getWaveComposition(8);
      expect(countOf(w8, "slime")).toBe(14 + 15);
      expect(countOf(w8, "bee")).toBe(9 + 30);
      expect(countOf(w8, "ogre")).toBe(3 + 9);
    });

    it("grows monotonically", () => {
      let previous = 0;
      for (let wave = 1; wave <= 15; wave++) {
        const current = total(getWaveComposition(wave));
        expect(current).toBeGreaterThan(previous);
        previous = current;
      }
    });
  });

  it("returns compositions that callers cannot corrupt", () => {
    // The old implementation mutated shared config objects while accumulating,
    // so a caller could poison later waves.
    const first = getWaveComposition(3);
    first[0].count = 9999;
    expect(countOf(getWaveComposition(3), "slime")).toBe(11);
  });

  it("treats wave zero and negatives as empty rather than throwing", () => {
    expect(total(getWaveComposition(0))).toBe(0);
    expect(total(getWaveComposition(-4))).toBe(0);
  });
});

describe("getWaveModifiers", () => {
  it("applies no scaling through wave 5", () => {
    for (const wave of [1, 2, 3, 4, 5]) {
      expect(getWaveModifiers(wave)).toEqual({ healthModifier: 1, speedModifier: 1 });
    }
  });

  it("adds 10% health and 5% speed per wave past the fifth", () => {
    expect(WAVE_SCALING.healthPerWave).toBe(0.1);
    expect(WAVE_SCALING.speedPerWave).toBe(0.05);

    const w6 = getWaveModifiers(6);
    expect(w6.healthModifier).toBeCloseTo(1.1);
    expect(w6.speedModifier).toBeCloseTo(1.05);

    const w10 = getWaveModifiers(10);
    expect(w10.healthModifier).toBeCloseTo(1.5);
    expect(w10.speedModifier).toBeCloseTo(1.25);
  });
});

describe("SPAWN_TIMING", () => {
  it("preserves GameScene's scheduling constants", () => {
    expect(SPAWN_TIMING.intervalMs).toBe(500);
    expect(SPAWN_TIMING.beeStartDelayMs).toBe(5000);
    expect(SPAWN_TIMING.ogreDelayAfterLastSlimeMs).toBe(3000);
    expect(SPAWN_TIMING.ogreMaxStartDelayMs).toBe(10000);
  });
});

describe("squareSpawnDelay", () => {
  // GameScene chose min(lastSlimeSpawn + 3000, 10000) so ogres never wait
  // longer than ten seconds no matter how long the slime column runs.
  it("follows the last slime by three seconds on short waves", () => {
    // 5 slimes -> last spawns at 2000ms -> ogres at 5000ms.
    expect(squareSpawnDelay(5)).toBe(5000);
  });

  it("caps at ten seconds on long waves", () => {
    // 30 slimes -> last spawns at 14500ms -> +3000 exceeds the cap.
    expect(squareSpawnDelay(30)).toBe(10000);
  });

  it("handles a wave with no slimes", () => {
    expect(squareSpawnDelay(0)).toBeGreaterThanOrEqual(0);
    expect(squareSpawnDelay(0)).toBeLessThanOrEqual(10000);
  });
});

describe("MAX_WAVES", () => {
  it("matches GameScene's victory threshold", () => {
    expect(MAX_WAVES).toBe(10);
  });
});
