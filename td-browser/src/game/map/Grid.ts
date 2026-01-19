import { TILE_SIZE, GRID_COLS, GRID_ROWS } from "../data/map2";

export function tileToWorldCenter(col: number, row: number) {
  return {
    x: col * TILE_SIZE + TILE_SIZE / 2,
    y: row * TILE_SIZE + TILE_SIZE / 2,
  };
}

export function worldToTile(x: number, y: number) {
  const col = Math.floor(x / TILE_SIZE);
  const row = Math.floor(y / TILE_SIZE);
  const inBounds = col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS;
  return { col, row, inBounds };
}
