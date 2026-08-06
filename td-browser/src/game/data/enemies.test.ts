import { describe, expect, it } from "vitest";
import { ENEMY_DEFS, getEnemyDef, scaledHealth, scaledSpeed } from "./enemies";
import { ENEMY_KINDS } from "../sim/entities";

describe("ENEMY_DEFS", () => {
  it("defines every enemy kind", () => {
    for (const kind of ENEMY_KINDS) {
      expect(ENEMY_DEFS[kind]).toBeDefined();
    }
  });

  // Lifted verbatim from the local constants inside each Enemy.ts constructor.
  describe("preserves the pre-extraction stats", () => {
    it("slime", () => {
      expect(ENEMY_DEFS.slime).toMatchObject({
        baseSpeed: 100,
        baseHealth: 5,
        reward: 5,
        lifeLoss: 1,
        spriteScale: 0.7,
        flipHorizontally: false,
      });
    });

    it("ogre", () => {
      expect(ENEMY_DEFS.ogre).toMatchObject({
        baseSpeed: 60,
        baseHealth: 8,
        reward: 20,
        lifeLoss: 5,
        spriteScale: 1.2,
        flipHorizontally: true,
      });
    });

    it("bee", () => {
      expect(ENEMY_DEFS.bee).toMatchObject({
        baseSpeed: 150,
        baseHealth: 3,
        reward: 10,
        lifeLoss: 2,
        spriteScale: 0.7,
        flipHorizontally: false,
      });
    });
  });

  it("names a texture key matching the loaded sprite sheets", () => {
    // BootScene registers sheets as `${key}-walk-down`, `${key}-death-side`, etc.
    expect(ENEMY_DEFS.slime.textureKey).toBe("slime");
    expect(ENEMY_DEFS.ogre.textureKey).toBe("ogre");
    expect(ENEMY_DEFS.bee.textureKey).toBe("bee");
  });

  it("contains only data — no functions", () => {
    for (const kind of ENEMY_KINDS) {
      for (const [field, value] of Object.entries(ENEMY_DEFS[kind])) {
        expect(typeof value, `ENEMY_DEFS.${kind}.${field}`).not.toBe("function");
      }
    }
  });
});

describe("getEnemyDef", () => {
  it("returns the definition for a kind", () => {
    expect(getEnemyDef("ogre").baseHealth).toBe(8);
  });

  it("returns definitions that callers cannot corrupt", () => {
    const def = getEnemyDef("slime");
    expect(() => {
      (def as { baseHealth: number }).baseHealth = 9999;
    }).toThrow();
  });
});

describe("scaledHealth", () => {
  // Enemy.ts applied `Math.floor(baseHealth * healthModifier)`.
  it("floors the scaled value, as the constructors did", () => {
    expect(scaledHealth("slime", 1)).toBe(5);
    expect(scaledHealth("slime", 1.1)).toBe(5); // 5.5 floors to 5
    expect(scaledHealth("slime", 1.5)).toBe(7); // 7.5 floors to 7
    expect(scaledHealth("ogre", 1.25)).toBe(10);
  });

  it("never yields less than one health", () => {
    // A floored zero would make an enemy that dies to nothing and cannot be
    // rewarded correctly. Nothing produces a modifier this small today.
    expect(scaledHealth("bee", 0)).toBe(1);
    expect(scaledHealth("bee", 0.1)).toBe(1);
  });
});

describe("scaledSpeed", () => {
  // Enemy.ts applied `baseSpeed * speedModifier` with no rounding.
  it("multiplies without rounding, as the constructors did", () => {
    expect(scaledSpeed("slime", 1)).toBe(100);
    expect(scaledSpeed("slime", 1.05)).toBeCloseTo(105);
    expect(scaledSpeed("ogre", 1.5)).toBe(90);
  });

  it("never yields a non-positive speed", () => {
    expect(scaledSpeed("bee", 0)).toBeGreaterThan(0);
  });
});
