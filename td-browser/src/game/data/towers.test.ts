import { describe, expect, it } from "vitest";
import { TOWER_DEFS, getTowerDef } from "./towers";
import { TOWER_KINDS } from "../sim/entities";

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

    it("still deals the projectile's old flat 3 damage", () => {
      // Deliberately un-differentiated. Phase 0's definition of done requires
      // that the game play exactly as before, so the *structure* moves now and
      // the *numbers* are a balance decision for the human. See
      // NOTES-FOR-HUMAN.md — this is the top tuning item.
      expect(TOWER_DEFS.basic.damage).toBe(3);
      expect(TOWER_DEFS.fast.damage).toBe(3);
      expect(TOWER_DEFS.long.damage).toBe(3);
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
