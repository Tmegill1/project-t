/**
 * Every map, and everything that varies between them.
 *
 * Before this, a map's dimensions were restated in five places — main.ts,
 * three scene-transition methods in GameScene, and the economy tables — and
 * the mapName type was a string union written out in three files. Adding a
 * third map meant touching all of them and hoping none were missed.
 *
 * `Grid` also read its bounds from the first map's constants regardless of
 * which map was loaded, so on any larger map the outer band silently rejected
 * every click. That is fixed by `setActiveMap`, which is the reason this
 * registry exists rather than being a tidy-up.
 */

import { GRID_COLS as DEMO_COLS, GRID_ROWS as DEMO_ROWS, TILE_SIZE, demoMap } from "./demoMap";
import { GRID_COLS as MAP2_COLS, GRID_ROWS as MAP2_ROWS, map2 } from "./map2";
import { GRID_COLS as MAP3_COLS, GRID_ROWS as MAP3_ROWS, map3 } from "./map3";
import type { TileKind } from "./demoMap";

export type MapName = "demoMap" | "map2" | "map3";

export const MAP_NAMES = ["demoMap", "map2", "map3"] as const satisfies readonly MapName[];

export interface MapDef {
  name: MapName;
  /** Shown to the player. */
  label: string;
  cols: number;
  rows: number;
  tileSize: number;
  tiles: TileKind[][];
  /** Total towers this map allows, across every kind. */
  towerBudget: number;
  startingGold: number;
  /** Which map follows this one on victory, or null when it is the last. */
  next: MapName | null;
}

/**
 * ⚠ The budgets and starting gold are the strongest difficulty levers here.
 * A bigger map is not automatically harder — more ground means more room to
 * build — so the budget grows more slowly than the area does.
 */
export const MAPS: Readonly<Record<MapName, MapDef>> = Object.freeze({
  demoMap: {
    name: "demoMap",
    label: "The Pass",
    cols: DEMO_COLS,
    rows: DEMO_ROWS,
    tileSize: TILE_SIZE,
    tiles: demoMap,
    towerBudget: 16,
    startingGold: 100,
    next: "map2",
  },
  map2: {
    name: "map2",
    label: "The Fork",
    cols: MAP2_COLS,
    rows: MAP2_ROWS,
    tileSize: TILE_SIZE,
    tiles: map2,
    towerBudget: 20,
    startingGold: 250,
    next: "map3",
  },
  map3: {
    name: "map3",
    label: "The Coils",
    cols: MAP3_COLS,
    rows: MAP3_ROWS,
    tileSize: TILE_SIZE,
    tiles: map3,
    // Widest board, but the serpentine route folds back on itself — a tower
    // on a bend covers two passes, so it needs fewer of them than its size
    // suggests.
    towerBudget: 18,
    startingGold: 200,
    next: null,
  },
});

export function getMap(name: MapName): MapDef {
  return MAPS[name];
}

/** Canvas size a map needs, in pixels. */
export function mapPixelSize(name: MapName): { width: number; height: number } {
  const map = MAPS[name];
  return { width: map.cols * map.tileSize, height: map.rows * map.tileSize };
}

/** The map a new game starts on. */
export const FIRST_MAP: MapName = "demoMap";
