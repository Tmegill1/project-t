import { TILE_SIZE } from "../data/demoMap";

export function tileToWorldCenter(col: number, row: number) {
  return {
    x: col * TILE_SIZE + TILE_SIZE / 2,
    y: row * TILE_SIZE + TILE_SIZE / 2,
  };
}
