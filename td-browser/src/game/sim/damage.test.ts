import { describe, expect, it } from "vitest";
import { resolveDamage } from "./damage";
import type { DamageSource, DamageTarget } from "./damage";

function target(overrides: Partial<DamageTarget> = {}): DamageTarget {
  return { health: 10, maxHealth: 10, alive: true, ...overrides };
}

function source(overrides: Partial<DamageSource> = {}): DamageSource {
  return { damage: 3, ...overrides };
}

describe("resolveDamage", () => {
  it("subtracts the source's damage from the target's health", () => {
    const result = resolveDamage(source({ damage: 4 }), target({ health: 10 }));
    expect(result.damageDealt).toBe(4);
    expect(result.remainingHealth).toBe(6);
    expect(result.lethal).toBe(false);
  });

  it("reports lethality when health reaches exactly zero", () => {
    const result = resolveDamage(source({ damage: 5 }), target({ health: 5 }));
    expect(result.remainingHealth).toBe(0);
    expect(result.lethal).toBe(true);
  });

  it("reports lethality when damage exceeds health", () => {
    const result = resolveDamage(source({ damage: 50 }), target({ health: 5 }));
    expect(result.lethal).toBe(true);
  });

  it("clamps remaining health at zero rather than going negative", () => {
    const result = resolveDamage(source({ damage: 50 }), target({ health: 5 }));
    expect(result.remainingHealth).toBe(0);
  });

  it("reports only the damage actually absorbed on a killing blow", () => {
    // Overkill is not damage dealt. Phase 3's economy scales rewards off real
    // contribution, so a 50-damage hit on a 5-health target dealt 5.
    const result = resolveDamage(source({ damage: 50 }), target({ health: 5 }));
    expect(result.damageDealt).toBe(5);
  });

  it("is a pure function — it does not mutate the target", () => {
    const t = target({ health: 10 });
    resolveDamage(source({ damage: 4 }), t);
    expect(t.health).toBe(10);
  });

  describe("towers with different damage values", () => {
    // The defect this whole step exists to fix: damage used to be a constant on
    // the projectile, so every tower hit for exactly 3.
    it("applies each source's own damage", () => {
      const t = target({ health: 100 });
      expect(resolveDamage(source({ damage: 3 }), t).remainingHealth).toBe(97);
      expect(resolveDamage(source({ damage: 8 }), t).remainingHealth).toBe(92);
      expect(resolveDamage(source({ damage: 20 }), t).remainingHealth).toBe(80);
    });
  });

  describe("targets that cannot be damaged", () => {
    it("deals nothing to an already-dead target", () => {
      const result = resolveDamage(source({ damage: 5 }), target({ health: 0, alive: false }));
      expect(result.damageDealt).toBe(0);
      expect(result.lethal).toBe(false);
    });

    it("does not re-report lethality on a corpse", () => {
      // Enemies stay in the scene briefly while their death animation plays.
      // Re-killing one would pay its reward twice.
      const result = resolveDamage(source({ damage: 5 }), target({ health: 0, alive: false }));
      expect(result.lethal).toBe(false);
      expect(result.remainingHealth).toBe(0);
    });
  });

  describe("input validation", () => {
    it("treats negative damage as zero rather than healing the target", () => {
      const result = resolveDamage(source({ damage: -5 }), target({ health: 10 }));
      expect(result.damageDealt).toBe(0);
      expect(result.remainingHealth).toBe(10);
    });

    it("handles zero damage without reporting a kill", () => {
      const result = resolveDamage(source({ damage: 0 }), target({ health: 10 }));
      expect(result.damageDealt).toBe(0);
      expect(result.lethal).toBe(false);
    });
  });
});
