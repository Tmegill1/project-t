import { describe, expect, it } from "vitest";
import { MAPS, MAP_NAMES, mapPixelSize } from "./maps";
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
describe("tower budgets", () => {
  it("gives every map a budget", () => {
    for (const name of MAP_NAMES) {
      expect(MAPS[name].towerBudget, name).toBeGreaterThan(0);
    }
  });

  it("binds before the per-kind caps, or it would do nothing", () => {
    // If a budget exceeded the sum of the caps it could never be the limiting
    // factor, and the lever would be decorative.
    const sumOfCaps = TOWER_KINDS.reduce((sum, kind) => sum + TOWER_DEFS[kind].baseLimit, 0);
    for (const name of MAP_NAMES) {
      expect(MAPS[name].towerBudget, name).toBeLessThan(sumOfCaps);
    }
  });

  it("still allows a mixed board rather than forcing one kind", () => {
    // A budget below the largest single cap would make the per-kind caps
    // unreachable and quietly turn the game into "pick one tower".
    const largestCap = Math.max(...TOWER_KINDS.map((kind) => TOWER_DEFS[kind].baseLimit));
    for (const name of MAP_NAMES) {
      expect(MAPS[name].towerBudget, name).toBeGreaterThan(largestCap);
    }
  });

  it("grows more slowly than the board does", () => {
    // A bigger map is not automatically harder — more ground means more room
    // to build. Budgets must lag area, or later maps get easier.
    const first = MAPS.demoMap;
    const firstArea = first.cols * first.rows;
    for (const name of MAP_NAMES) {
      if (name === "demoMap") continue;
      const map = MAPS[name];
      const areaRatio = (map.cols * map.rows) / firstArea;
      const budgetRatio = map.towerBudget / first.towerBudget;
      expect(budgetRatio, name).toBeLessThan(areaRatio);
    }
  });

  it("leaves room for every kind to be represented", () => {
    // A player should be able to field all four and still have towers spare,
    // or the counter system cannot be engaged with.
    for (const name of MAP_NAMES) {
      expect(MAPS[name].towerBudget, name).toBeGreaterThanOrEqual(TOWER_KINDS.length * 3);
    }
  });

  it("sizes each canvas from the map itself", () => {
    for (const name of MAP_NAMES) {
      const { width, height } = mapPixelSize(name);
      expect(width).toBe(MAPS[name].cols * MAPS[name].tileSize);
      expect(height).toBe(MAPS[name].rows * MAPS[name].tileSize);
    }
  });
});
