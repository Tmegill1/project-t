import { describe, expect, it } from "vitest";
import { TOWER_BUDGET } from "./economy";
import { TOWER_DEFS } from "./towers";
import { TOWER_KINDS } from "../sim/entities";

/**
 * The per-map tower budget: a difficulty lever that asks the player a question
 * rather than inflating a number.
 *
 * Scaling monster health harder only demands more damage. A tighter board
 * demands choices — which towers, where, and how deep to commit each, given the
 * cross-path rule means no tower does everything.
 */
describe("TOWER_BUDGET", () => {
  it("covers every map", () => {
    expect(TOWER_BUDGET.demoMap).toBeGreaterThan(0);
    expect(TOWER_BUDGET.map2).toBeGreaterThan(0);
  });

  it("binds before the per-kind caps, or it would do nothing", () => {
    // If the budget exceeded the sum of the caps it could never be the
    // limiting factor, and the lever would be decorative.
    const sumOfCaps = TOWER_KINDS.reduce((sum, kind) => sum + TOWER_DEFS[kind].baseLimit, 0);
    expect(TOWER_BUDGET.demoMap).toBeLessThan(sumOfCaps);
  });

  it("still allows a mixed board rather than forcing one kind", () => {
    // A budget below the largest single cap would make the per-kind caps
    // unreachable and quietly turn the game into "pick one tower".
    const largestCap = Math.max(...TOWER_KINDS.map((kind) => TOWER_DEFS[kind].baseLimit));
    expect(TOWER_BUDGET.demoMap).toBeGreaterThan(largestCap);
  });

  it("gives the larger map more room, but not proportionally more", () => {
    // map2 is 26x17 against demoMap's 23x14 — roughly 1.4x the tiles. The
    // budget grows more slowly, so the bigger board is the harder one.
    expect(TOWER_BUDGET.map2).toBeGreaterThan(TOWER_BUDGET.demoMap);
    expect(TOWER_BUDGET.map2 / TOWER_BUDGET.demoMap).toBeLessThan(26 * 17 / (23 * 14));
  });

  it("leaves room for every kind to be represented", () => {
    // A player should be able to field all three and still have towers spare,
    // or the counter system cannot be engaged with.
    expect(TOWER_BUDGET.demoMap).toBeGreaterThanOrEqual(TOWER_KINDS.length * 3);
  });
});
