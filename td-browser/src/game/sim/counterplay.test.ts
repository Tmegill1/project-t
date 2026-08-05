import { describe, expect, it } from "vitest";
import { simulateWave } from "./harness";
import { ENEMY_PROPERTIES } from "./properties";
import type { HarnessConfig, HarnessTower } from "./harness";
import type { EnemyProperty } from "./properties";
import type { PathPoint, TowerKind } from "./entities";
import { emptyTiers, resolveTowerStats } from "./upgrades";
import type { UpgradeTiers } from "./upgrades";

/**
 * Phase 1's central claim, under test: **no single build efficiently clears
 * every enemy property combination.**
 *
 * If one build did, enemy properties would be decoration and the upgrade
 * branches would be a shopping list rather than a decision. These tests are the
 * thing that keeps that honest as numbers get tuned.
 */

const LANE: PathPoint[] = [
  { x: 0, y: 300 },
  { x: 1100, y: 300 },
];

const tiers = (sustained: number, burst: number): UpgradeTiers => ({ sustained, burst });

/** Places `count` towers of one kind evenly along the lane. */
function line(kind: TowerKind, count: number, upgrades: UpgradeTiers): HarnessTower[] {
  return Array.from({ length: count }, (_, i) => ({
    kind,
    position: { x: 160 + i * (820 / Math.max(1, count)), y: 300 },
    upgrades,
  }));
}

/**
 * Candidate builds, each a legal, fully-committed specialisation. All cost
 * roughly the same and respect the per-type tower caps.
 */
const BUILDS: Array<{ name: string; towers: HarnessTower[] }> = [
  { name: "basic / barrage (splash)", towers: line("basic", 5, tiers(4, 2)) },
  { name: "basic / marksman (detection)", towers: line("basic", 5, tiers(2, 4)) },
  { name: "fast / suppression (slow)", towers: line("fast", 5, tiers(4, 2)) },
  { name: "fast / hollow point", towers: line("fast", 5, tiers(2, 4)) },
  { name: "long / bombardment (splash)", towers: line("long", 3, tiers(4, 2)) },
  { name: "long / siege (pierce)", towers: line("long", 3, tiers(2, 4)) },
];

/** Each property in isolation, plus the pairs that matter most. */
const THREATS: Array<{ name: string; properties: EnemyProperty[] }> = [
  ...ENEMY_PROPERTIES.map((p) => ({ name: p, properties: [p] })),
  { name: "armored+shielded", properties: ["armored", "shielded"] },
  { name: "phased+swift", properties: ["phased", "swift"] },
  { name: "armored+splitter", properties: ["armored", "splitter"] },
];

function run(towers: HarnessTower[], properties: EnemyProperty[]): ReturnType<typeof simulateWave> {
  const config: HarnessConfig = {
    path: LANE,
    wave: 5,
    seed: 4242,
    towers,
    enemyProperties: properties,
  };
  return simulateWave(config);
}

/** Share of enemies stopped. 1 means a clean hold. */
function clearRate(towers: HarnessTower[], properties: EnemyProperty[]): number {
  const result = run(towers, properties);
  return result.spawned === 0 ? 1 : result.killed / result.spawned;
}

/** A build "handles" a threat when it stops nearly everything. */
const COMPETENT = 0.9;

describe("no single build answers everything", () => {
  const table = BUILDS.map((build) => ({
    build,
    rates: THREATS.map((threat) => ({
      threat: threat.name,
      rate: clearRate(build.towers, threat.properties),
    })),
  }));

  it("leaves every build with at least one threat it handles badly", () => {
    for (const { build, rates } of table) {
      const failures = rates.filter((r) => r.rate < COMPETENT);
      expect(
        failures.length,
        `${build.name} cleared every threat competently: ` +
          rates.map((r) => `${r.threat}=${(r.rate * 100).toFixed(0)}%`).join(", "),
      ).toBeGreaterThan(0);
    }
  });

  it("gives every threat at least one build that does answer it", () => {
    // The other half of the claim. A threat nothing can beat is not a counter,
    // it is a wall.
    for (const threat of THREATS) {
      const best = Math.max(...BUILDS.map((b) => clearRate(b.towers, threat.properties)));
      expect(best, `no build handled ${threat.name}`).toBeGreaterThanOrEqual(COMPETENT);
    }
  });

  it("has no build that is best against every threat", () => {
    const winners = new Set<string>();
    for (const threat of THREATS) {
      let bestName = "";
      let bestRate = -1;
      for (const build of BUILDS) {
        const rate = clearRate(build.towers, threat.properties);
        if (rate > bestRate) {
          bestRate = rate;
          bestName = build.name;
        }
      }
      winners.add(bestName);
    }
    expect(winners.size).toBeGreaterThan(1);
  });
});

describe("each property is answered by the build the design intends", () => {
  it("armour falls to pierce, not to rapid fire", () => {
    const pierce = clearRate(line("long", 3, tiers(2, 4)), ["armored"]);
    const rapid = clearRate(line("fast", 5, tiers(4, 2)), ["armored"]);
    expect(pierce).toBeGreaterThan(rapid);
  });

  it("shields fall to rapid fire, not to heavy single hits", () => {
    const rapid = clearRate(line("fast", 5, tiers(4, 2)), ["shielded"]);
    const heavy = clearRate(line("long", 3, tiers(2, 4)), ["shielded"]);
    expect(rapid).toBeGreaterThan(heavy);
  });

  it("armour and shields demand opposite builds", () => {
    // Restated at the whole-wave level rather than per hit: the build that
    // wins one must lose the other, or the properties collapse into one.
    const rapid = line("fast", 5, tiers(4, 2));
    const pierce = line("long", 3, tiers(2, 4));

    expect(clearRate(rapid, ["shielded"])).toBeGreaterThan(clearRate(pierce, ["shielded"]));
    expect(clearRate(pierce, ["armored"])).toBeGreaterThan(clearRate(rapid, ["armored"]));
  });

  it("phasing blinds every build that did not buy detection", () => {
    for (const build of BUILDS) {
      // Asked of the stats rather than the build's name, so renaming a build
      // cannot quietly make this assertion vacuous.
      const hasDetection = build.towers.some(
        (t) => resolveTowerStats(t.kind, t.upgrades ?? emptyTiers()).detection,
      );
      const rate = clearRate(build.towers, ["phased"]);
      if (hasDetection) {
        expect(rate, `${build.name} has detection`).toBeGreaterThanOrEqual(COMPETENT);
      } else {
        expect(rate, `${build.name} has no detection`).toBe(0);
      }
    }
  });

  it("puts detection out of reach of a build that skipped the marksman branch", () => {
    // Detection sits at tier 3, past the cross-path cap, so the two free
    // off-branch tiers every tower gets cannot buy it.
    expect(resolveTowerStats("basic", tiers(4, 2)).detection).toBe(false);
    expect(resolveTowerStats("basic", tiers(2, 3)).detection).toBe(true);
  });

  it("swiftness leaks past builds that cannot slow it", () => {
    const slowing = run(line("fast", 5, tiers(4, 2)), ["swift"]);
    const notSlowing = run(line("fast", 5, tiers(2, 4)), ["swift"]);
    expect(slowing.leaked).toBeLessThanOrEqual(notSlowing.leaked);
  });

  it("splitters produce more enemies than the wave spawned", () => {
    const result = run(line("long", 3, tiers(2, 4)), ["splitter"]);
    expect(result.splitSpawns).toBeGreaterThan(0);
    expect(result.spawned).toBeGreaterThan(result.splitSpawns);
  });

  it("splash handles splitters better than single-target does", () => {
    const splash = clearRate(line("basic", 5, tiers(4, 2)), ["splitter"]);
    const single = clearRate(line("basic", 5, tiers(2, 4)), ["splitter"]);
    expect(splash).toBeGreaterThanOrEqual(single);
  });
});

describe("the harness reports why a build failed", () => {
  it("attributes armour losses to armour", () => {
    const result = run(line("fast", 5, tiers(4, 2)), ["armored"]);
    expect(result.armorBlocked).toBeGreaterThan(0);
  });

  it("attributes shield losses to shields", () => {
    const result = run(line("long", 3, tiers(2, 4)), ["shielded"]);
    expect(result.shieldedHits).toBeGreaterThan(0);
  });

  it("reports towers that could not see their target", () => {
    const result = run(line("long", 3, tiers(2, 4)), ["phased"]);
    expect(result.shotsFired).toBe(0);
    expect(result.shotsWithoutTarget).toBeGreaterThan(0);
  });
});

describe("determinism holds with properties in play", () => {
  it("returns identical results for identical inputs", () => {
    for (const threat of THREATS) {
      const towers = line("basic", 5, tiers(2, 4));
      expect(run(towers, threat.properties)).toEqual(run(towers, threat.properties));
    }
  });
});
