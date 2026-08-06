/**
 * The tile vocabulary, in one place.
 *
 * `TILE_SIZE` and `TileKind` were previously exported from `demoMap` and
 * re-exported from `map2`, so nine files imported the same two symbols from
 * three different modules — some from the first map, some from the second,
 * chosen apparently at random. They happened to agree, which is the only
 * reason it never broke: a map with a different tile size would have silently
 * rendered at the wrong scale depending on which module a file had picked.
 */

/** Side length of one tile, in pixels. Every map shares it. */
export const TILE_SIZE = 48;

export type TileKind = "buildable" | "path" | "blocked" | "spawn" | "goal";
