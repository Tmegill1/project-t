import { describe, expect, it } from "vitest";
import {
  CROSS_PATH_CAP,
  MAX_TIER,
  canUpgrade,
  emptyTiers,
  resolveTowerStats,
  totalInvested,
  upgradeCost,
  withUpgrade,
} from "./upgrades";
import type { UpgradeTiers } from "./upgrades";
import { TOWER_DEFS } from "../data/towers";
import { TOWER_KINDS } from "./entities";

const tiers = (sustained: number, burst: number): UpgradeTiers => ({ sustained, burst });

describe("emptyTiers", () => {
  it("starts both branches at zero", () => {
    expect(emptyTiers()).toEqual({ sustained: 0, burst: 0 });
  });

  it("returns a fresh object each time", () => {
    const a = emptyTiers();
    a.sustained = 3;
    expect(emptyTiers().sustained).toBe(0);
  });
});

describe("canUpgrade", () => {
  it("allows the first tier on either branch", () => {
    expect(canUpgrade(tiers(0, 0), "sustained")).toBe(true);
    expect(canUpgrade(tiers(0, 0), "burst")).toBe(true);
  });

  it("allows climbing to the cross-path cap on both branches", () => {
    expect(canUpgrade(tiers(1, 2), "sustained")).toBe(true);
    expect(canUpgrade(tiers(2, 1), "burst")).toBe(true);
  });

  it("refuses to exceed the maximum tier", () => {
    expect(canUpgrade(tiers(MAX_TIER, 0), "sustained")).toBe(false);
  });

  describe("cross-path gating", () => {
    // The rule that makes upgrading a choice: one branch goes deep only if the
    // other stays shallow. Without it every tower ends up identical and fully
    // upgraded, and there is nothing to decide.
    it("allows passing the cap when the other branch is at or below it", () => {
      expect(canUpgrade(tiers(CROSS_PATH_CAP, CROSS_PATH_CAP), "sustained")).toBe(true);
      expect(canUpgrade(tiers(CROSS_PATH_CAP, CROSS_PATH_CAP), "burst")).toBe(true);
    });

    it("caps the off-branch below the maximum, so both cannot be maxed", () => {
      expect(CROSS_PATH_CAP).toBeLessThan(MAX_TIER);
    });

    it("blocks the second branch once the first has gone deep", () => {
      expect(canUpgrade(tiers(3, 2), "burst")).toBe(false);
      expect(canUpgrade(tiers(2, 3), "sustained")).toBe(false);
    });

    it("still allows deepening the branch that already committed", () => {
      expect(canUpgrade(tiers(3, 2), "sustained")).toBe(true);
      expect(canUpgrade(tiers(2, 3), "burst")).toBe(true);
    });

    it("permits a full tier-4 commitment with the other capped", () => {
      expect(canUpgrade(tiers(3, 2), "sustained")).toBe(true);
      expect(canUpgrade(tiers(4, 2), "sustained")).toBe(false); // maxed
      expect(canUpgrade(tiers(4, 2), "burst")).toBe(false); // gated
    });

    it("makes a double-maxed tower unreachable", () => {
      // The point of the whole rule.
      expect(canUpgrade(tiers(4, 3), "burst")).toBe(false);
      expect(canUpgrade(tiers(3, 3), "burst")).toBe(false);
    });
  });
});

describe("withUpgrade", () => {
  it("raises the chosen branch by one", () => {
    expect(withUpgrade(tiers(1, 0), "sustained")).toEqual({ sustained: 2, burst: 0 });
  });

  it("is pure — it does not mutate its input", () => {
    const before = tiers(1, 1);
    withUpgrade(before, "burst");
    expect(before).toEqual({ sustained: 1, burst: 1 });
  });

  it("refuses an illegal upgrade rather than silently allowing it", () => {
    expect(() => withUpgrade(tiers(3, 2), "burst")).toThrow();
  });

  it("can walk a legal path to tier 4", () => {
    let current = emptyTiers();
    for (let i = 0; i < 4; i++) current = withUpgrade(current, "burst");
    expect(current).toEqual({ sustained: 0, burst: 4 });
  });
});

describe("upgradeCost", () => {
  it("quotes a positive price for every reachable tier", () => {
    for (const kind of TOWER_KINDS) {
      for (const branch of ["sustained", "burst"] as const) {
        for (let tier = 0; tier < MAX_TIER; tier++) {
          expect(upgradeCost(kind, branch, tier)).toBeGreaterThan(0);
        }
      }
    }
  });

  it("gets more expensive as tiers climb", () => {
    for (const kind of TOWER_KINDS) {
      for (const branch of ["sustained", "burst"] as const) {
        for (let tier = 1; tier < MAX_TIER; tier++) {
          expect(upgradeCost(kind, branch, tier)).toBeGreaterThan(
            upgradeCost(kind, branch, tier - 1),
          );
        }
      }
    }
  });

  it("costs nothing beyond the last tier, since there is nothing to buy", () => {
    expect(upgradeCost("basic", "sustained", MAX_TIER)).toBe(0);
  });
});

describe("totalInvested", () => {
  it("sums the price of every tier bought", () => {
    const spent = totalInvested("basic", tiers(2, 1));
    const expected =
      upgradeCost("basic", "sustained", 0) +
      upgradeCost("basic", "sustained", 1) +
      upgradeCost("basic", "burst", 0);
    expect(spent).toBe(expected);
  });

  it("is zero for a fresh tower", () => {
    expect(totalInvested("basic", emptyTiers())).toBe(0);
  });
});

describe("resolveTowerStats", () => {
  it("returns the base stats when nothing is upgraded", () => {
    for (const kind of TOWER_KINDS) {
      const stats = resolveTowerStats(kind, emptyTiers());
      expect(stats.damage).toBe(TOWER_DEFS[kind].damage);
      expect(stats.fireRate).toBe(TOWER_DEFS[kind].fireRate);
      expect(stats.range).toBe(TOWER_DEFS[kind].range);
      expect(stats.pierce).toBe(0);
      expect(stats.detection).toBe(false);
      expect(stats.splashRadius).toBe(0);
    }
  });

  it("never makes a tower worse than its base", () => {
    for (const kind of TOWER_KINDS) {
      const base = resolveTowerStats(kind, emptyTiers());
      for (const t of [tiers(1, 0), tiers(0, 1), tiers(2, 2), tiers(4, 2), tiers(2, 4)]) {
        const upgraded = resolveTowerStats(kind, t);
        expect(upgraded.damage).toBeGreaterThanOrEqual(base.damage);
        expect(upgraded.fireRate).toBeLessThanOrEqual(base.fireRate);
        expect(upgraded.range).toBeGreaterThanOrEqual(base.range);
      }
    }
  });

  it("is pure and repeatable", () => {
    const t = tiers(2, 2);
    expect(resolveTowerStats("basic", t)).toEqual(resolveTowerStats("basic", t));
  });

  describe("the two branches do different jobs", () => {
    // If both branches produced the same kind of tower, the cross-path rule
    // would be an arbitrary restriction rather than a choice.
    it("burst raises damage per hit more than sustained does", () => {
      for (const kind of TOWER_KINDS) {
        const burst = resolveTowerStats(kind, tiers(0, 4));
        const sustained = resolveTowerStats(kind, tiers(4, 0));
        expect(burst.damage).toBeGreaterThan(sustained.damage);
      }
    });

    it("sustained raises rate of fire more than burst does", () => {
      for (const kind of TOWER_KINDS) {
        const burst = resolveTowerStats(kind, tiers(0, 4));
        const sustained = resolveTowerStats(kind, tiers(4, 0));
        expect(sustained.fireRate).toBeLessThan(burst.fireRate);
      }
    });
  });

  describe("counters are earned, not given", () => {
    it("grants pierce only through the burst branch", () => {
      for (const kind of TOWER_KINDS) {
        expect(resolveTowerStats(kind, tiers(4, 0)).pierce).toBe(0);
      }
      const anyBurstPierce = TOWER_KINDS.some(
        (kind) => resolveTowerStats(kind, tiers(0, 4)).pierce > 0,
      );
      expect(anyBurstPierce).toBe(true);
    });

    it("grants splash only through the sustained branch", () => {
      for (const kind of TOWER_KINDS) {
        expect(resolveTowerStats(kind, tiers(0, 4)).splashRadius).toBe(0);
      }
      const anySustainedSplash = TOWER_KINDS.some(
        (kind) => resolveTowerStats(kind, tiers(0 + 4, 0)).splashRadius > 0,
      );
      expect(anySustainedSplash).toBe(true);
    });

    it("puts detection behind exactly one tower, so phasing costs a real choice", () => {
      const providers = TOWER_KINDS.filter(
        (kind) =>
          resolveTowerStats(kind, tiers(4, 2)).detection ||
          resolveTowerStats(kind, tiers(2, 4)).detection,
      );
      expect(providers).toHaveLength(1);
    });

    it("puts slowing behind exactly one tower, so swiftness costs a real choice", () => {
      const providers = TOWER_KINDS.filter(
        (kind) =>
          resolveTowerStats(kind, tiers(4, 2)).slowFactor < 1 ||
          resolveTowerStats(kind, tiers(2, 4)).slowFactor < 1,
      );
      expect(providers).toHaveLength(1);
    });

    it("gives no single fully-upgraded tower every answer", () => {
      // The heart of the phase. A tower that had pierce, splash, detection and
      // slowing at once would counter all five properties by itself.
      for (const kind of TOWER_KINDS) {
        for (const t of [tiers(4, 2), tiers(2, 4)]) {
          const s = resolveTowerStats(kind, t);
          const answers = [s.pierce > 0, s.splashRadius > 0, s.detection, s.slowFactor < 1];
          expect(answers.filter(Boolean).length, `${kind} ${JSON.stringify(t)}`).toBeLessThan(4);
        }
      }
    });
  });
});
