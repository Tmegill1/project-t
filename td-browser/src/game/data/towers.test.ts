import { describe, expect, it } from "vitest";
import { TOWER_DEFS, getTowerDef } from "./towers";
import { TOWER_KINDS } from "../sim/entities";
import { PROPERTY_VALUES } from "../sim/properties";
import { escalatedCost } from "../sim/economy";

// Sprite frames are deliberately absent from the "preserves the pre-extraction
// stats" checks below. The original indices were cut from a 100px grid that did
// not divide the sheet — frame 2 straddled two sprites — so those numbers do not
// mean the same thing on the corrected 96px grid. Frame choice is asserted in
// upgrades.test.ts instead, against the series each tower now uses.
describe("TOWER_DEFS", () => {
  it("defines every tower kind", () => {
    for (const kind of TOWER_KINDS) {
      expect(TOWER_DEFS[kind]).toBeDefined();
    }
  });

  // These are the values the game shipped with, lifted out of the `static
  // readonly` constants on Towers.ts and TowerManager's hardcoded tables.
  // Phase 0 must not change visible behaviour, so they are asserted verbatim.
  describe("preserves the pre-extraction stats", () => {
    it("basic", () => {
      expect(TOWER_DEFS.basic).toMatchObject({
        cost: 20,
        range: 100,
        fireRate: 1000,
        color: 0x0066ff,
        size: 0.8,
      });
    });

    it("fast", () => {
      expect(TOWER_DEFS.fast).toMatchObject({
        cost: 50,
        range: 80,
        fireRate: 500,
        color: 0x00ff00,
        size: 0.75,
      });
    });

    it("long", () => {
      expect(TOWER_DEFS.long).toMatchObject({
        cost: 100,
        range: 150,
        fireRate: 1500,
        color: 0xff6600,
        size: 0.85,
      });
    });
  });

  describe("damage", () => {
    it("gives every tower its own damage field", () => {
      // The defect this replaces: damage was `Projectile.damage = 3`, a
      // constant on the projectile, so it could not vary by tower at all.
      for (const kind of TOWER_KINDS) {
        expect(typeof TOWER_DEFS[kind].damage).toBe("number");
        expect(TOWER_DEFS[kind].damage).toBeGreaterThan(0);
      }
    });

    it("gives each tower a distinct damage-per-hit shape", () => {
      // Phase 1 needs these to differ, because armoured and shielded enemies
      // are answered by opposite shapes. Equal damage made cadence the only
      // variable, which made FastTower strictly dominant.
      expect(TOWER_DEFS.fast.damage).toBeLessThan(TOWER_DEFS.basic.damage);
      expect(TOWER_DEFS.basic.damage).toBeLessThan(TOWER_DEFS.long.damage);
    });

    it("makes rapid fire unable to scratch armour on its own", () => {
      // The counter has to actually bite: 2 damage against 4 armour is zero.
      expect(TOWER_DEFS.fast.damage).toBeLessThanOrEqual(PROPERTY_VALUES.armorValue);
    });

    it("makes heavy hits punch straight through armour", () => {
      expect(TOWER_DEFS.long.damage).toBeGreaterThan(PROPERTY_VALUES.armorValue * 2);
    });

    it("keeps no tower dominant on damage per second", () => {
      // If one tower led on both DPS and cost-efficiency there would be no
      // reason to build the others, whatever their damage shape.
      const dps = (kind: "basic" | "fast" | "long") =>
        (TOWER_DEFS[kind].damage / TOWER_DEFS[kind].fireRate) * 1000;
      const perGold = (kind: "basic" | "fast" | "long") => dps(kind) / TOWER_DEFS[kind].cost;

      const bestDps = (["basic", "fast", "long"] as const).reduce((a, b) =>
        dps(a) >= dps(b) ? a : b,
      );
      const bestValue = (["basic", "fast", "long"] as const).reduce((a, b) =>
        perGold(a) >= perGold(b) ? a : b,
      );
      expect(bestDps).not.toBe(bestValue);
    });

    it("starts every tower without pierce or detection", () => {
      // Both are earned through upgrades, so a fresh board cannot answer
      // armour or phasing without investment.
      for (const kind of TOWER_KINDS) {
        expect(TOWER_DEFS[kind].pierce).toBe(0);
        expect(TOWER_DEFS[kind].detection).toBe(false);
      }
    });
  });

  describe("map2 tower limits", () => {
    it("raises every limit by two, matching TowerManager", () => {
      for (const kind of TOWER_KINDS) {
        expect(TOWER_DEFS[kind].limitBonusMap2).toBe(2);
      }
    });
  });

  it("contains only data — no functions", () => {
    // "Code reads data; data contains no logic." A function here would be a
    // rule hiding in the stats table.
    for (const kind of TOWER_KINDS) {
      for (const [field, value] of Object.entries(TOWER_DEFS[kind])) {
        expect(typeof value, `TOWER_DEFS.${kind}.${field}`).not.toBe("function");
      }
    }
  });
});

describe("getTowerDef", () => {
  it("returns the definition for a kind", () => {
    expect(getTowerDef("fast").fireRate).toBe(500);
  });

  it("returns definitions that callers cannot corrupt", () => {
    const def = getTowerDef("basic");
    expect(() => {
      (def as { cost: number }).cost = 9999;
    }).toThrow();
    expect(getTowerDef("basic").cost).toBe(20);
  });
});

describe("the board has room to absorb a full run's gold", () => {
  // The caps were the original progression gate, written before upgrades,
  // powers or meta-progression existed. Measured across a full run, 5/5/3
  // pinned the board at thirteen towers from wave 8 while gold climbed past
  // two thousand unspent — winning turned into waiting.
  it("allows meaningfully more than the original thirteen towers", () => {
    const total = TOWER_KINDS.reduce((sum, kind) => sum + TOWER_DEFS[kind].baseLimit, 0);
    expect(total).toBeGreaterThan(13);
  });

  it("still caps each kind, so the board cannot become one tower repeated", () => {
    for (const kind of TOWER_KINDS) {
      expect(TOWER_DEFS[kind].baseLimit).toBeLessThan(15);
      expect(Number.isFinite(TOWER_DEFS[kind].baseLimit)).toBe(true);
    }
  });

  it("keeps escalation, so spamming one kind still costs more each time", () => {
    for (const kind of TOWER_KINDS) {
      expect(TOWER_DEFS[kind].costEscalation).toBeGreaterThan(0);
    }
  });

  it("keeps the tenth tower of a kind affordable within a run's income", () => {
    // At the old rate the eighth long-range tower cost 800 gold on its own.
    for (const kind of TOWER_KINDS) {
      const def = TOWER_DEFS[kind];
      expect(escalatedCost(def.cost, def.baseLimit - 1, def.costEscalation)).toBeLessThan(500);
    }
  });
});

describe("the Mortar is the area specialist", () => {
  it("is the only tower with splash before any upgrade", () => {
    // Area damage is what it *is*, not something it earns. Every other tower
    // has to commit to a sustained branch for it.
    const withBaseSplash = TOWER_KINDS.filter((kind) => TOWER_DEFS[kind].baseSplashRadius > 0);
    expect(withBaseSplash).toEqual(["mortar"]);
  });

  it("pays for that with the worst single-target damage per second", () => {
    const dps = (kind: (typeof TOWER_KINDS)[number]) =>
      (TOWER_DEFS[kind].damage / TOWER_DEFS[kind].fireRate) * 1000;
    for (const kind of TOWER_KINDS) {
      if (kind === "mortar") continue;
      expect(dps("mortar"), `vs ${kind}`).toBeLessThan(dps(kind));
    }
  });

  it("has no access to the other towers' answers", () => {
    // Pierce, detection and slowing belong to Long Range, Basic and Fast. A
    // tower that could reach them would answer everything by itself.
    expect(TOWER_DEFS.mortar.pierce).toBe(0);
    expect(TOWER_DEFS.mortar.detection).toBe(false);
  });

  it("costs more than the generalist, less than the artillery", () => {
    expect(TOWER_DEFS.mortar.cost).toBeGreaterThan(TOWER_DEFS.basic.cost);
    expect(TOWER_DEFS.mortar.cost).toBeLessThan(TOWER_DEFS.long.cost);
  });
});

describe("four towers, four silhouettes", () => {
  it("gives every tower its own frames", () => {
    const all = TOWER_KINDS.flatMap((kind) => [...TOWER_DEFS[kind].upgradeFrames]);
    expect(new Set(all).size).toBe(all.length);
  });

  it("uses only frames the sheet contains", () => {
    // towers.png is 480x384 on a 96px grid: five across, four down.
    for (const kind of TOWER_KINDS) {
      for (const frame of TOWER_DEFS[kind].upgradeFrames) {
        expect(frame, `${kind}`).toBeGreaterThanOrEqual(0);
        expect(frame, `${kind}`).toBeLessThan(20);
      }
    }
  });

  it("gives each tower a distinct colour for its range ring and shots", () => {
    const colors = TOWER_KINDS.map((kind) => TOWER_DEFS[kind].color);
    expect(new Set(colors).size).toBe(colors.length);
  });
});

describe("projectile flight", () => {
  it("gives the Mortar a slower shot than every other tower", () => {
    for (const kind of TOWER_KINDS) {
      if (kind === "mortar") continue;
      expect(TOWER_DEFS.mortar.projectileSpeed, `vs ${kind}`).toBeLessThan(
        TOWER_DEFS[kind].projectileSpeed,
      );
    }
  });

  it("makes it about 30% slower than direct fire", () => {
    const direct = TOWER_DEFS.basic.projectileSpeed;
    const ratio = TOWER_DEFS.mortar.projectileSpeed / direct;
    expect(ratio).toBeGreaterThan(0.6);
    expect(ratio).toBeLessThan(0.75);
  });

  it("keeps enough margin over the fastest enemy to still connect", () => {
    // Closing speed, not raw speed, is what decides whether a shell chasing a
    // fleeing enemy ever lands. Too fine a margin and the Mortar simply misses.
    const fastestEnemy = 150 * 1.6;
    expect(TOWER_DEFS.mortar.projectileSpeed - fastestEnemy).toBeGreaterThan(80);
  });

  it("lobs only the Mortar's shots", () => {
    const arcing = TOWER_KINDS.filter((kind) => TOWER_DEFS[kind].projectileArcs);
    expect(arcing).toEqual(["mortar"]);
  });

  it("keeps every projectile fast enough to outrun the enemies it chases", () => {
    // A shot slower than its target can never land.
    const fastestEnemy = 150 * 1.6; // bee base speed with the swift multiplier
    for (const kind of TOWER_KINDS) {
      expect(TOWER_DEFS[kind].projectileSpeed, kind).toBeGreaterThan(fastestEnemy);
    }
  });
});
