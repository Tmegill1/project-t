import { describe, expect, it } from "vitest";
import {
  MAX_WAVES,
  SPAWN_TIMING,
  WAVE_SCALING,
  PROPERTY_INTRODUCTION,
  getWaveComposition,
  getWaveModifiers,
  propertiesFor,
  squareSpawnDelay,
} from "./waves";
import { hasBoss } from "./bosses";

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
      expect(countOf(w6, "slime")).toBe(14 + 2);
      expect(countOf(w6, "bee")).toBe(9 + 5);
      expect(countOf(w6, "ogre")).toBe(3 + 2);
    });

    it("stacks bundles linearly", () => {
      const w8 = getWaveComposition(8);
      expect(countOf(w8, "slime")).toBe(14 + 6);
      expect(countOf(w8, "bee")).toBe(9 + 15);
      expect(countOf(w8, "ogre")).toBe(3 + 6);
    });

    it("keeps a full run's final wave to a playable size", () => {
      // The original added eighteen enemies a wave forever; wave 20 fielded
      // nearly three hundred in one lane, at which point volume decided the
      // wave rather than whether the player brought the right counter.
      expect(total(getWaveComposition(MAX_WAVES))).toBeLessThan(180);
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
    expect(MAX_WAVES).toBe(20);
  });

  it("runs long enough to show every enemy property", () => {
    // At ten waves, three of the five properties never appeared in normal
    // play. Content the player cannot reach is content that does not exist.
    for (const [property, introducedAt] of Object.entries(PROPERTY_INTRODUCTION)) {
      expect(introducedAt, `${property} arrives after the game ends`).toBeLessThan(MAX_WAVES);
    }
  });
});

describe("enemy properties across waves", () => {
  it("keeps the opening waves plain", () => {
    // Properties are the phase's teaching tool. Introducing one before the
    // player has gold for its counter is a wall, not a lesson.
    const firstProperty = Math.min(...Object.values(PROPERTY_INTRODUCTION));
    for (let wave = 1; wave < firstProperty; wave++) {
      for (const entry of getWaveComposition(wave)) {
        expect(entry.properties ?? [], `wave ${wave} ${entry.kind}`).toEqual([]);
      }
    }
  });

  it("introduces properties one at a time", () => {
    const introductions = Object.values(PROPERTY_INTRODUCTION);
    expect(new Set(introductions).size).toBe(introductions.length);
  });

  it("introduces phasing last, since it hard-gates on detection", () => {
    const others = Object.entries(PROPERTY_INTRODUCTION)
      .filter(([property]) => property !== "phased")
      .map(([, wave]) => wave);
    expect(PROPERTY_INTRODUCTION.phased).toBeGreaterThan(Math.max(...others));
  });

  it("never makes a whole wave phased", () => {
    // The mitigation for phasing being a 0% wall: it rides one enemy kind, so
    // a player without detection leaks that group rather than the wave.
    for (let wave = PROPERTY_INTRODUCTION.phased; wave <= 30; wave++) {
      const composition = getWaveComposition(wave);
      const phasedGroups = composition.filter((e) => e.properties?.includes("phased"));
      expect(phasedGroups.length).toBeLessThan(composition.length);

      const phasedCount = phasedGroups.reduce((sum, e) => sum + e.count, 0);
      const totalCount = composition.reduce((sum, e) => sum + e.count, 0);
      expect(phasedCount).toBeLessThan(totalCount);
    }
  });

  it("keeps a property once it has been introduced", () => {
    for (const [property, introducedAt] of Object.entries(PROPERTY_INTRODUCTION)) {
      for (const wave of [introducedAt, introducedAt + 5, introducedAt + 20]) {
        const present = getWaveComposition(wave).some((e) =>
          e.properties?.includes(property as never),
        );
        expect(present, `${property} missing at wave ${wave}`).toBe(true);
      }
    }
  });

  it("adds nothing before its introduction wave", () => {
    for (const [property, introducedAt] of Object.entries(PROPERTY_INTRODUCTION)) {
      const present = getWaveComposition(introducedAt - 1).some((e) =>
        e.properties?.includes(property as never),
      );
      expect(present, `${property} arrived early`).toBe(false);
    }
  });

  it("does not leak properties between calls", () => {
    const first = getWaveComposition(20);
    first[0].properties = ["armored"];
    const second = getWaveComposition(20);
    expect(second[0].properties).not.toEqual(["armored"]);
  });
});

describe("propertiesFor", () => {
  it("gives a kind only the properties it carries", () => {
    expect(propertiesFor("ogre", 7)).toContain("armored");
    expect(propertiesFor("slime", 7)).not.toContain("armored");
  });

  it("returns nothing for an early wave", () => {
    expect(propertiesFor("ogre", 1)).toEqual([]);
  });
});

describe("no property arrives before the player can answer it", () => {
  it("never makes an enemy immune on the wave its kind is introduced", () => {
    // Armour 4 makes an enemy immune to both the Basic and Fast towers. Putting
    // it on the wave ogres first appear gives the player an enemy they have no
    // way to kill — which is how the first tuning pass accidentally made the
    // game unwinnable at wave 4.
    for (const [property, introducedAt] of Object.entries(PROPERTY_INTRODUCTION)) {
      const carrier = getWaveComposition(introducedAt).find((e) =>
        e.properties?.includes(property as never),
      );
      expect(carrier, `${property} has no carrier at wave ${introducedAt}`).toBeDefined();

      // The kind must have appeared plain on an earlier wave first.
      const earlier = getWaveComposition(introducedAt - 1);
      const plainBefore = earlier.find(
        (e) => e.kind === carrier!.kind && !e.properties?.includes(property as never),
      );
      expect(
        plainBefore,
        `${property} lands on ${carrier!.kind} before the player has met a plain one`,
      ).toBeDefined();
    }
  });

  it("gives armour time for a Long Range tower to be affordable", () => {
    // Basic (4 damage) and Fast (2) do nothing through armour 4. Only Long
    // Range, at 100 gold, can answer it without an upgrade.
    expect(PROPERTY_INTRODUCTION.armored).toBeGreaterThanOrEqual(6);
  });
});

describe("properties and bosses do not arrive together", () => {
  it("never introduces a property on a boss wave", () => {
    // A boss already asks a full wave's question. Introducing a property the
    // player has never seen on the same wave asks two at once, and they cannot
    // tell which one beat them.
    for (const [property, wave] of Object.entries(PROPERTY_INTRODUCTION)) {
      expect(hasBoss(wave), `${property} arrives on a boss wave (${wave})`).toBe(false);
    }
  });
});
