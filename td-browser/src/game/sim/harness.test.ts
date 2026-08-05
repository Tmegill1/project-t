import { describe, expect, it } from "vitest";
import { simulateWave } from "./harness";
import type { HarnessConfig } from "./harness";
import type { PathPoint } from "./entities";

/** A straight 1200px corridor. Long enough that towers get real firing time. */
const LANE: PathPoint[] = [
  { x: 0, y: 300 },
  { x: 1200, y: 300 },
];

function config(overrides: Partial<HarnessConfig> = {}): HarnessConfig {
  return {
    path: LANE,
    wave: 1,
    seed: 1234,
    towers: [],
    ...overrides,
  };
}

describe("simulateWave", () => {
  describe("determinism", () => {
    // The whole point of the harness. Without this, a balance result cannot be
    // reproduced and therefore cannot be diagnosed.
    it("returns an identical result for an identical seed", () => {
      const setup = config({
        wave: 4,
        seed: 777,
        towers: [{ kind: "basic", position: { x: 400, y: 300 } }],
      });
      expect(simulateWave(setup)).toEqual(simulateWave(setup));
    });

    it("is identical across repeated runs of a heavier wave", () => {
      const setup = config({
        wave: 8,
        seed: 31337,
        towers: [
          { kind: "basic", position: { x: 300, y: 300 } },
          { kind: "fast", position: { x: 600, y: 300 } },
          { kind: "long", position: { x: 900, y: 300 } },
        ],
      });
      const runs = Array.from({ length: 5 }, () => simulateWave(setup));
      for (const run of runs) expect(run).toEqual(runs[0]);
    });

    it("does not mutate the config it was given", () => {
      const setup = config({
        wave: 3,
        towers: [{ kind: "basic", position: { x: 400, y: 300 } }],
      });
      const snapshot = structuredClone(setup);
      simulateWave(setup);
      expect(setup).toEqual(snapshot);
    });
  });

  describe("an undefended lane", () => {
    const undefended = simulateWave(config({ wave: 1 }));

    it("leaks every enemy", () => {
      expect(undefended.leaked).toBe(5); // wave 1 is five slimes
      expect(undefended.killed).toBe(0);
    });

    it("earns no gold", () => {
      expect(undefended.goldEarned).toBe(0);
    });

    it("costs one life per slime at wave 1", () => {
      expect(undefended.livesLost).toBe(5);
    });

    it("takes time to play out", () => {
      expect(undefended.timeElapsed).toBeGreaterThan(0);
    });
  });

  describe("an overwhelming defence", () => {
    const defended = simulateWave(
      config({
        wave: 1,
        towers: Array.from({ length: 8 }, (_, i) => ({
          kind: "fast" as const,
          position: { x: 150 + i * 120, y: 300 },
        })),
      }),
    );

    it("kills every enemy", () => {
      expect(defended.killed).toBe(5);
      expect(defended.leaked).toBe(0);
    });

    it("loses no lives", () => {
      expect(defended.livesLost).toBe(0);
    });

    it("earns each kill's reward", () => {
      expect(defended.goldEarned).toBe(25); // five slimes at 5 gold
    });
  });

  it("accounts for every enemy as either killed or leaked", () => {
    for (const wave of [1, 3, 5, 7]) {
      for (const towerCount of [0, 1, 3]) {
        const result = simulateWave(
          config({
            wave,
            towers: Array.from({ length: towerCount }, (_, i) => ({
              kind: "basic" as const,
              position: { x: 250 + i * 300, y: 300 },
            })),
          }),
        );
        expect(result.killed + result.leaked, `wave ${wave}, ${towerCount} towers`).toBe(
          result.spawned,
        );
      }
    }
  });

  describe("tower strength changes the outcome", () => {
    const withTowers = (count: number) =>
      simulateWave(
        config({
          wave: 3,
          towers: Array.from({ length: count }, (_, i) => ({
            kind: "basic" as const,
            position: { x: 200 + i * 200, y: 300 },
          })),
        }),
      );

    it("kills more with more towers", () => {
      expect(withTowers(4).killed).toBeGreaterThan(withTowers(1).killed);
    });

    it("leaks fewer with more towers", () => {
      expect(withTowers(4).leaked).toBeLessThan(withTowers(1).leaked);
    });
  });

  describe("range matters", () => {
    it("a tower far from the lane never fires", () => {
      const outOfRange = simulateWave(
        config({ wave: 1, towers: [{ kind: "basic", position: { x: 600, y: 2000 } }] }),
      );
      expect(outOfRange.killed).toBe(0);
      expect(outOfRange.shotsFired).toBe(0);
    });

    it("a tower on the lane fires", () => {
      const inRange = simulateWave(
        config({ wave: 1, towers: [{ kind: "basic", position: { x: 600, y: 300 } }] }),
      );
      expect(inRange.shotsFired).toBeGreaterThan(0);
    });
  });

  describe("late-wave life loss", () => {
    it("charges remaining health per leak past wave 5", () => {
      // The wave-5 rule: a leak costs the enemy's remaining health, which is
      // far more than its flat life value.
      const early = simulateWave(config({ wave: 5, composition: [{ kind: "ogre", count: 1 }] }));
      const late = simulateWave(config({ wave: 6, composition: [{ kind: "ogre", count: 1 }] }));
      expect(early.livesLost).toBe(5); // the ogre's flat lifeLoss
      expect(late.livesLost).toBeGreaterThan(early.livesLost);
    });
  });

  describe("explicit compositions", () => {
    it("simulates exactly the enemies given", () => {
      const result = simulateWave(config({ wave: 1, composition: [{ kind: "bee", count: 3 }] }));
      expect(result.spawned).toBe(3);
      expect(result.leaked).toBe(3);
      expect(result.livesLost).toBe(6); // bees cost 2 lives each
    });

    it("handles an empty composition without hanging", () => {
      const result = simulateWave(config({ composition: [] }));
      expect(result.spawned).toBe(0);
      expect(result.killed).toBe(0);
      expect(result.leaked).toBe(0);
    });
  });

  describe("termination", () => {
    it("stops even under a heavy wave with a weak defence", () => {
      // A guard against the loop running forever if an enemy stalls.
      const result = simulateWave(
        config({ wave: 10, towers: [{ kind: "basic", position: { x: 600, y: 300 } }] }),
      );
      expect(result.timedOut).toBe(false);
      expect(result.timeElapsed).toBeLessThan(600_000);
    });
  });

  describe("insignia", () => {
    it("reports zero until lieutenants exist", () => {
      // Phase 2 introduces the only sources. The field is present now so the
      // harness's shape does not change under later phases.
      expect(simulateWave(config({ wave: 3 })).insigniaEarned).toBe(0);
    });
  });

  describe("timestep", () => {
    it("gives close results at different resolutions", () => {
      // A result that swings wildly with the timestep is measuring the
      // integrator, not the balance.
      const towers = [{ kind: "fast" as const, position: { x: 500, y: 300 } }];
      const coarse = simulateWave(config({ wave: 3, towers, timestepMs: 32 }));
      const fine = simulateWave(config({ wave: 3, towers, timestepMs: 8 }));
      expect(Math.abs(coarse.killed - fine.killed)).toBeLessThanOrEqual(2);
    });
  });
});
