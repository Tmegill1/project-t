import { describe, expect, it } from "vitest";
import { FIRST_MAP, MAP_NAMES, getMap } from "./maps";
import { buildMap3 } from "./map3";
import { getAllSpawnPaths } from "../map/PathFinder";
import { getActiveGrid, setActiveGrid, worldToTile } from "../map/Grid";
import { createRng } from "../sim/rng";
import type { MapName } from "./maps";
import type { TileKind } from "./demoMap";

function count(tiles: TileKind[][], kind: TileKind): number {
  return tiles.reduce((sum, row) => sum + row.filter((t) => t === kind).length, 0);
}

describe("the map registry", () => {
  it("describes every map", () => {
    for (const name of MAP_NAMES) {
      const map = getMap(name);
      expect(map.cols, name).toBeGreaterThan(0);
      expect(map.rows, name).toBeGreaterThan(0);
      expect(map.label.length, name).toBeGreaterThan(0);
    }
  });

  it("matches each map's declared size to its actual grid", () => {
    // These were restated in five places before the registry existed. A
    // mismatch here is a canvas that does not fit its board.
    for (const name of MAP_NAMES) {
      const map = getMap(name);
      expect(map.tiles.length, `${name} rows`).toBe(map.rows);
      expect(map.tiles[0].length, `${name} cols`).toBe(map.cols);
    }
  });

  it("chains the maps into a campaign that terminates", () => {
    const visited = new Set<MapName>();
    let current: MapName | null = FIRST_MAP;
    while (current && !visited.has(current)) {
      visited.add(current);
      current = getMap(current).next;
    }
    // Every map reachable, and no cycle.
    expect(visited.size).toBe(MAP_NAMES.length);
    expect(current).toBeNull();
  });

  it("gives every map a route from spawn to goal", () => {
    // A map whose path does not connect is unplayable, and the failure looks
    // like enemies never spawning rather than like a broken map.
    for (const name of MAP_NAMES) {
      const paths = getAllSpawnPaths(getMap(name).tiles);
      expect(paths.length, `${name} has no spawn path`).toBeGreaterThan(0);
      for (const path of paths) {
        expect(path.length, `${name} path is empty`).toBeGreaterThan(1);
      }
    }
  });

  it("leaves every map somewhere to build", () => {
    for (const name of MAP_NAMES) {
      expect(count(getMap(name).tiles, "buildable"), name).toBeGreaterThan(40);
    }
  });
});

describe("★ the grid follows the loaded map", () => {
  // The bug this fixes: Grid imported the *first* map's dimensions and used
  // them whatever was playing, so on any larger map the outer band reported
  // out of bounds and silently refused every tower placement. On the second
  // map that was 111 of 365 buildable tiles.
  it("reports tiles inside a larger map as in bounds", () => {
    const map = getMap("map3");
    setActiveGrid(map.cols, map.rows, map.tileSize);

    // A tile past the first map's 23x14 that exists on this one.
    const farCol = map.cols - 2;
    const farRow = map.rows - 2;
    const world = {
      x: farCol * map.tileSize + map.tileSize / 2,
      y: farRow * map.tileSize + map.tileSize / 2,
    };

    const tile = worldToTile(world.x, world.y);
    expect(tile.col).toBe(farCol);
    expect(tile.row).toBe(farRow);
    expect(tile.inBounds).toBe(true);
  });

  it("still rejects anything genuinely off the board", () => {
    const map = getMap("map3");
    setActiveGrid(map.cols, map.rows, map.tileSize);
    expect(worldToTile(map.cols * map.tileSize + 10, 10).inBounds).toBe(false);
    expect(worldToTile(10, map.rows * map.tileSize + 10).inBounds).toBe(false);
    expect(worldToTile(-10, 10).inBounds).toBe(false);
  });

  it("reaches every buildable tile on every map", () => {
    // The measure that matters: no buildable tile may be unclickable.
    for (const name of MAP_NAMES) {
      const map = getMap(name);
      setActiveGrid(map.cols, map.rows, map.tileSize);

      let unreachable = 0;
      for (let row = 0; row < map.rows; row++) {
        for (let col = 0; col < map.cols; col++) {
          if (map.tiles[row][col] !== "buildable") continue;
          const world = {
            x: col * map.tileSize + map.tileSize / 2,
            y: row * map.tileSize + map.tileSize / 2,
          };
          if (!worldToTile(world.x, world.y).inBounds) unreachable++;
        }
      }
      expect(unreachable, `${name} has unreachable buildable tiles`).toBe(0);
    }
  });

  it("reports what it is currently using", () => {
    const map = getMap("map2");
    setActiveGrid(map.cols, map.rows, map.tileSize);
    expect(getActiveGrid()).toEqual({
      cols: map.cols,
      rows: map.rows,
      tileSize: map.tileSize,
    });
  });
});

describe("the third map", () => {
  const map3 = getMap("map3");

  it("is larger than the first", () => {
    const first = getMap("demoMap");
    expect(map3.cols * map3.rows).toBeGreaterThan(first.cols * first.rows);
  });

  it("runs a longer route than the first, not just a bigger board", () => {
    // The serpentine's point: it folds back three times, so a tower on a bend
    // covers two passes. More area alone would only mean more room to build.
    const first = getAllSpawnPaths(getMap("demoMap").tiles)[0];
    const third = getAllSpawnPaths(map3.tiles)[0];
    expect(third.length).toBeGreaterThan(first.length * 1.3);
  });

  it("is reproducible from a seed", () => {
    expect(buildMap3(createRng(1234))).toEqual(buildMap3(createRng(1234)));
  });

  it("varies with the seed", () => {
    expect(buildMap3(createRng(1))).not.toEqual(buildMap3(createRng(2)));
  });

  it("never blocks its own route, whatever the seed", () => {
    const routeLength = count(map3.tiles, "path");
    for (let seed = 0; seed < 25; seed++) {
      const built = buildMap3(createRng(seed));
      expect(count(built, "path"), `seed ${seed}`).toBe(routeLength);
      expect(getAllSpawnPaths(built).length, `seed ${seed}`).toBeGreaterThan(0);
    }
  });

  it("keeps exactly one spawn and one goal", () => {
    expect(count(map3.tiles, "spawn")).toBe(1);
    expect(count(map3.tiles, "goal")).toBe(1);
  });
});
