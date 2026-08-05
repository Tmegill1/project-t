import { describe, expect, it } from "vitest";
import { TOWER_DEFS, getTowerDef } from "./towers";
import { TOWER_KINDS } from "../sim/entities";
import { PROPERTY_VALUES } from "../sim/properties";

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
        spriteFrame: 0,
        costEscalation: 20,
        baseLimit: 5,
      });
    });

    it("fast", () => {
      expect(TOWER_DEFS.fast).toMatchObject({
        cost: 50,
        range: 80,
        fireRate: 500,
        color: 0x00ff00,
        size: 0.75,
        spriteFrame: 1,
        costEscalation: 30,
        baseLimit: 5,
      });
    });

    it("long", () => {
      expect(TOWER_DEFS.long).toMatchObject({
        cost: 100,
        range: 150,
        fireRate: 1500,
        color: 0xff6600,
        size: 0.85,
        spriteFrame: 2,
        costEscalation: 100,
        baseLimit: 3,
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
