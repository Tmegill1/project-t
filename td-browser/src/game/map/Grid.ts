import { GRID_COLS, GRID_ROWS } from "../data/demoMap";
import { TILE_SIZE } from "../data/tiles";

/**
 * Tile ↔ world-pixel conversion for whichever map is loaded.
 *
 * This used to import the *first* map's dimensions and use them regardless of
 * which map was actually playing. Every larger map therefore had an outer band
 * — the columns and rows past 23×14 — where `worldToTile` reported out of
 * bounds and `GameScene` silently refused to place a tower. On the second map
 * that was 111 of 365 buildable tiles, or 30% of the board, rejecting clicks
 * with no feedback at all.
 *
 * The active dimensions are module state rather than a parameter because
 * `worldToTile` is called from pointer handlers scattered across the scene,
 * and threading a map through every one of them would be a large change for
 * no benefit — there is only ever one map loaded.
 */

let activeCols = GRID_COLS;
let activeRows = GRID_ROWS;
let activeTileSize = TILE_SIZE;

/**
 * Points the grid at a map. Call from `GameScene.init` before anything reads
 * a tile coordinate.
 */
export function setActiveGrid(cols: number, rows: number, tileSize: number = TILE_SIZE) {
  activeCols = cols;
  activeRows = rows;
  activeTileSize = tileSize;
}

/** The dimensions currently in force. */
export function getActiveGrid(): { cols: number; rows: number; tileSize: number } {
  return { cols: activeCols, rows: activeRows, tileSize: activeTileSize };
}

export function tileToWorldCenter(col: number, row: number) {
  return {
    x: col * activeTileSize + activeTileSize / 2,
    y: row * activeTileSize + activeTileSize / 2,
  };
}

export function worldToTile(x: number, y: number) {
  const col = Math.floor(x / activeTileSize);
  const row = Math.floor(y / activeTileSize);
  const inBounds = col >= 0 && col < activeCols && row >= 0 && row < activeRows;
  return { col, row, inBounds };
}
