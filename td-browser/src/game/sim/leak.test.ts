import { describe, expect, it } from "vitest";
import { LIFE_LOSS_SCALING_WAVE, resolveLeakPenalty } from "./leak";

describe("resolveLeakPenalty", () => {
  // Reproduces BaseEnemy.update()'s rule exactly:
  //   wave > 5 ? Math.max(1, Math.ceil(health)) : lifeLoss
  describe("at or below the scaling wave", () => {
    it("costs the enemy's flat life value", () => {
      expect(resolveLeakPenalty({ lifeLoss: 1, health: 5 }, 1)).toBe(1);
      expect(resolveLeakPenalty({ lifeLoss: 5, health: 8 }, 3)).toBe(5);
      expect(resolveLeakPenalty({ lifeLoss: 2, health: 3 }, 5)).toBe(2);
    });

    it("ignores remaining health entirely", () => {
      expect(resolveLeakPenalty({ lifeLoss: 1, health: 999 }, 5)).toBe(1);
    });
  });

  describe("past the scaling wave", () => {
    it("costs the enemy's remaining health instead", () => {
      expect(resolveLeakPenalty({ lifeLoss: 1, health: 12 }, 6)).toBe(12);
    });

    it("rounds fractional health up", () => {
      expect(resolveLeakPenalty({ lifeLoss: 1, health: 7.2 }, 6)).toBe(8);
    });

    it("never costs less than one life", () => {
      expect(resolveLeakPenalty({ lifeLoss: 5, health: 0.1 }, 9)).toBe(1);
      expect(resolveLeakPenalty({ lifeLoss: 5, health: 0 }, 9)).toBe(1);
    });

    it("switches over exactly after wave 5", () => {
      expect(LIFE_LOSS_SCALING_WAVE).toBe(5);
      expect(resolveLeakPenalty({ lifeLoss: 1, health: 20 }, 5)).toBe(1);
      expect(resolveLeakPenalty({ lifeLoss: 1, health: 20 }, 6)).toBe(20);
    });
  });

  describe("exemptions", () => {
    it("costs nothing when the enemy is exempt", () => {
      // Phase 2 lieutenants leave with their Insignia at zero life cost — the
      // escape is an opportunity cost, never a punishment. Nothing sets this
      // flag yet; the path exists so lieutenants are not bolted on later.
      expect(resolveLeakPenalty({ lifeLoss: 5, health: 50, exemptFromLifeLoss: true }, 9)).toBe(0);
      expect(resolveLeakPenalty({ lifeLoss: 5, health: 50, exemptFromLifeLoss: true }, 1)).toBe(0);
    });
  });

  it("is pure — it does not mutate the enemy", () => {
    const enemy = { lifeLoss: 1, health: 12 };
    resolveLeakPenalty(enemy, 6);
    expect(enemy).toEqual({ lifeLoss: 1, health: 12 });
  });
});
