import { createRng } from "../sim/rng";
import type { Rng } from "../sim/rng";
import { DEFAULT_MAP3_SEED } from "./seeds";
import type { TileKind } from "./demoMap";

/**
 * The third map: a serpentine.
 *
 * Wider than both predecessors and deliberately a different shape. The first
 * map zigzags once, the second runs two lanes that converge; this one folds
 * back on itself three times, so the route is roughly half again as long as
 * the first map's across a similar area.
 *
 * That changes what a tower is worth rather than just how many fit. A long
 * fold means a single tower can cover two passes of the same route, so
 * placement at the bends matters more than raw coverage — and the extra travel
 * time gives slow, heavy towers more shots per enemy than they get anywhere
 * else.
 */

export const TILE_SIZE = 48;
export const GRID_COLS = 28;
export const GRID_ROWS = 16;

/** Row the route enters on, and the column it leaves by. */
const SPAWN_ROW = 2;
const GOAL_COL = GRID_COLS - 2;
const GOAL_ROW = 13;

/** Whether a tile touches the route, which decides how likely it is to be
 *  blocked — clutter near the path is what shapes the buildable area. */
function isAdjacentToPath(row: number, col: number, pathSet: Set<string>): boolean {
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
    const r = row + dr;
    const c = col + dc;
    if (r >= 0 && r < GRID_ROWS && c >= 0 && c < GRID_COLS && pathSet.has(`${r},${c}`)) {
      return true;
    }
  }
  return false;
}

/**
 * Builds the third map's tile grid.
 *
 * Seeded like the others, so the blocked-tile layout is reproducible and the
 * headless harness can model this map as well as the first two.
 */
export function buildMap3(rng: Rng = createRng(DEFAULT_MAP3_SEED)): TileKind[][] {
  const map: TileKind[][] = Array.from({ length: GRID_ROWS }, () =>
    Array.from({ length: GRID_COLS }, () => "buildable" as TileKind),
  );

  const pathCoords: Array<[number, number]> = [];
  const runRow = (row: number, from: number, to: number) => {
    const step = from <= to ? 1 : -1;
    for (let c = from; step > 0 ? c <= to : c >= to; c += step) pathCoords.push([c, row]);
  };
  const runCol = (col: number, from: number, to: number) => {
    const step = from <= to ? 1 : -1;
    for (let r = from; step > 0 ? r <= to : r >= to; r += step) pathCoords.push([col, r]);
  };

  // Three folds. Each straight is long enough that a tower placed on a bend
  // covers two passes, which is the shape's whole point.
  runRow(SPAWN_ROW, 0, 23);
  runCol(23, SPAWN_ROW, 6);
  runRow(6, 23, 3);
  runCol(3, 6, 10);
  runRow(10, 3, 23);
  runCol(23, 10, GOAL_ROW);
  runRow(GOAL_ROW, 23, GOAL_COL);

  const pathSet = new Set<string>();
  for (const [c, r] of pathCoords) {
    map[r][c] = "path";
    pathSet.add(`${r},${c}`);
  }

  map[SPAWN_ROW][0] = "spawn";
  map[GOAL_ROW][GOAL_COL] = "goal";

  // The spawn and goal sprites are drawn larger than a tile, so the ground
  // they cover is blocked rather than buildable.
  const blockAround = (row: number, col: number) => {
    for (let r = row - 1; r <= row + 1; r++) {
      for (let c = col - 1; c <= col + 1; c++) {
        if (r >= 0 && r < GRID_ROWS && c >= 0 && c < GRID_COLS && map[r][c] === "buildable") {
          map[r][c] = "blocked";
        }
      }
    }
  };
  blockAround(SPAWN_ROW, 0);
  blockAround(GOAL_ROW, GOAL_COL);

  // Scatter clutter. Tiles beside the route are blocked more readily than
  // distant ones, so the good positions stay contested.
  const adjacent: Array<[number, number]> = [];
  const distant: Array<[number, number]> = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (map[r][c] !== "buildable") continue;
      if (r === 0) continue; // Top row carries the HUD.
      if (c === GRID_COLS - 1) continue; // Last column carries the tower menu.
      (isAdjacentToPath(r, c, pathSet) ? adjacent : distant).push([r, c]);
    }
  }

  const MAX_ADJACENT = 6;
  const MAX_DISTANT = 9;

  for (const [r, c] of rng.shuffle(adjacent).slice(0, MAX_ADJACENT)) map[r][c] = "blocked";
  for (const [r, c] of rng.shuffle(distant).slice(0, MAX_DISTANT)) map[r][c] = "blocked";

  return map;
}

/** The map as the game loads it, using the default seed. */
export const map3: TileKind[][] = buildMap3();
