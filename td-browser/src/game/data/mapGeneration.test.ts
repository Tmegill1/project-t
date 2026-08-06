import { describe, expect, it } from "vitest";
import { GRID_COLS, GRID_ROWS, buildDemoMap, demoMap } from "./demoMap";
import { buildMap2, map2 } from "./map2";
import { DEFAULT_DEMO_MAP_SEED } from "./seeds";
import { createRng } from "../sim/rng";
import type { TileKind } from "./demoMap";

function countKind(map: TileKind[][], kind: TileKind): number {
  return map.reduce((sum, row) => sum + row.filter((tile) => tile === kind).length, 0);
}

describe("map generation determinism", () => {
  // Before seeding, these generators called bare Math.random() at module load,
  // so the playable area differed on every page load and no run could be
  // reproduced. The headless harness depends on this being fixed.
  it("produces an identical demo map for the same seed", () => {
    const a = buildDemoMap(createRng(4242));
    const b = buildDemoMap(createRng(4242));
    expect(a).toEqual(b);
  });

  it("produces an identical second map for the same seed", () => {
    expect(buildMap2(createRng(99))).toEqual(buildMap2(createRng(99)));
  });

  it("produces a different layout for a different seed", () => {
    const a = buildDemoMap(createRng(1));
    const b = buildDemoMap(createRng(2));
    expect(a).not.toEqual(b);
  });

  it("exports a map matching its default seed", () => {
    expect(demoMap).toEqual(buildDemoMap(createRng(DEFAULT_DEMO_MAP_SEED)));
  });

  it("does not share mutable state between builds", () => {
    // Each call must produce its own grid, or one caller's mutation leaks.
    const a = buildDemoMap(createRng(7));
    const b = buildDemoMap(createRng(7));
    a[0][0] = "blocked";
    expect(b[0][0]).not.toBe("blocked");
  });
});

describe("map structure is unchanged by seeding", () => {
  it("keeps the demo map's dimensions", () => {
    expect(demoMap.length).toBe(GRID_ROWS);
    expect(demoMap[0].length).toBe(GRID_COLS);
  });

  it("keeps exactly one spawn and one goal", () => {
    expect(countKind(demoMap, "spawn")).toBe(1);
    expect(countKind(demoMap, "goal")).toBe(1);
  });

  it("still blocks tiles and still leaves plenty buildable", () => {
    expect(countKind(demoMap, "blocked")).toBeGreaterThan(0);
    expect(countKind(demoMap, "buildable")).toBeGreaterThan(20);
  });

  it("never blocks a path tile", () => {
    // The randomised blocking only ever selects from buildable tiles. If a seed
    // could block the route, enemies would have no way through.
    for (let seed = 0; seed < 25; seed++) {
      const map = buildDemoMap(createRng(seed));
      expect(countKind(map, "path")).toBe(countKind(demoMap, "path"));
    }
  });

  it("caps blocked tiles across every seed", () => {
    // 12 randomly placed, plus the fixed spawn and goal sprite footprints.
    for (let seed = 0; seed < 25; seed++) {
      expect(countKind(buildDemoMap(createRng(seed)), "blocked")).toBeLessThanOrEqual(25);
    }
  });

  it("keeps the second map larger than the first", () => {
    expect(map2.length).toBeGreaterThan(demoMap.length);
    expect(map2[0].length).toBeGreaterThan(demoMap[0].length);
  });
});
