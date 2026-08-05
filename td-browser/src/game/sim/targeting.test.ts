import { describe, expect, it } from "vitest";
import {
  DEFAULT_TARGETING_PRIORITY,
  TARGETING_PRIORITIES,
  isTargetable,
  nextPriority,
  selectTarget,
} from "./targeting";
import type { TargetCandidate, TargetingPriority, TargetingTower } from "./targeting";

function tower(overrides: Partial<TargetingTower> = {}): TargetingTower {
  return { position: { x: 0, y: 0 }, range: 500, priority: "closest", ...overrides };
}

function enemy(id: number, overrides: Partial<TargetCandidate> = {}): TargetCandidate {
  return {
    id,
    position: { x: 100, y: 0 },
    health: 10,
    pathIndex: 1,
    alive: true,
    dying: false,
    ...overrides,
  };
}

describe("selectTarget", () => {
  const lineup = [
    enemy(1, { position: { x: 100, y: 0 }, health: 5, pathIndex: 1 }),
    enemy(2, { position: { x: 200, y: 0 }, health: 30, pathIndex: 4 }),
    enemy(3, { position: { x: 300, y: 0 }, health: 12, pathIndex: 2 }),
  ];

  it("picks the nearest for 'closest'", () => {
    expect(selectTarget(tower({ priority: "closest" }), lineup)?.id).toBe(1);
  });

  it("picks the furthest along the route for 'first'", () => {
    expect(selectTarget(tower({ priority: "first" }), lineup)?.id).toBe(2);
  });

  it("picks the least far along for 'last'", () => {
    expect(selectTarget(tower({ priority: "last" }), lineup)?.id).toBe(1);
  });

  it("picks the highest health for 'strongest'", () => {
    expect(selectTarget(tower({ priority: "strongest" }), lineup)?.id).toBe(2);
  });

  it("returns null when nothing is in range", () => {
    expect(selectTarget(tower({ range: 10 }), lineup)).toBeNull();
  });

  it("returns null for an empty field", () => {
    expect(selectTarget(tower(), [])).toBeNull();
  });

  describe("eligibility", () => {
    it("ignores the dead", () => {
      const dead = [enemy(1, { alive: false })];
      expect(selectTarget(tower(), dead)).toBeNull();
    });

    it("ignores the dying, so shots are not wasted on corpses", () => {
      expect(selectTarget(tower(), [enemy(1, { dying: true })])).toBeNull();
    });

    it("ignores anything beyond range", () => {
      const far = [enemy(1, { position: { x: 10_000, y: 0 } })];
      expect(selectTarget(tower(), far)).toBeNull();
    });

    it("includes an enemy exactly on the range boundary", () => {
      const edge = [enemy(1, { position: { x: 500, y: 0 } })];
      expect(selectTarget(tower({ range: 500 }), edge)?.id).toBe(1);
    });
  });

  describe("phasing", () => {
    const phased = [enemy(1, { phased: true })];

    it("hides phased enemies from a tower without detection", () => {
      expect(selectTarget(tower(), phased)).toBeNull();
    });

    it("reveals them to a tower with detection", () => {
      expect(selectTarget(tower({ detection: true }), phased)?.id).toBe(1);
    });

    it("still lets a blind tower shoot unphased enemies in the same group", () => {
      const mixed = [enemy(1, { phased: true, position: { x: 50, y: 0 } }), enemy(2)];
      expect(selectTarget(tower(), mixed)?.id).toBe(2);
    });
  });

  describe("determinism", () => {
    it("breaks ties on the lowest id", () => {
      const identical = [enemy(7), enemy(3), enemy(5)];
      expect(selectTarget(tower(), identical)?.id).toBe(3);
    });

    it("does not depend on iteration order", () => {
      const forward = [enemy(1), enemy(2), enemy(3)];
      const backward = [...forward].reverse();
      for (const priority of TARGETING_PRIORITIES) {
        const t = tower({ priority });
        expect(selectTarget(t, forward)?.id).toBe(selectTarget(t, backward)?.id);
      }
    });
  });

  it("supports every declared priority", () => {
    for (const priority of TARGETING_PRIORITIES) {
      expect(selectTarget(tower({ priority }), lineup)).not.toBeNull();
    }
  });
});

describe("isTargetable", () => {
  it("agrees with selectTarget on eligibility", () => {
    expect(isTargetable(tower(), enemy(1))).toBe(true);
    expect(isTargetable(tower(), enemy(1, { dying: true }))).toBe(false);
    expect(isTargetable(tower({ range: 1 }), enemy(1))).toBe(false);
  });
});

describe("nextPriority", () => {
  it("cycles through every priority and returns to the start", () => {
    let current: TargetingPriority = TARGETING_PRIORITIES[0];
    const seen = new Set<TargetingPriority>([current]);
    for (let i = 0; i < TARGETING_PRIORITIES.length - 1; i++) {
      current = nextPriority(current);
      seen.add(current);
    }
    expect(seen.size).toBe(TARGETING_PRIORITIES.length);
    expect(nextPriority(current)).toBe(TARGETING_PRIORITIES[0]);
  });
});

describe("DEFAULT_TARGETING_PRIORITY", () => {
  it("matches the behaviour towers had before priorities existed", () => {
    // Every tower used to shoot whatever was nearest. A new tower must behave
    // the same way until the player says otherwise.
    expect(DEFAULT_TARGETING_PRIORITY).toBe("closest");
  });
});
