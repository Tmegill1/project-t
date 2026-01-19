import { GRID_COLS, GRID_ROWS, map2 as demoMap, type TileKind } from "../data/map2";
import { tileToWorldCenter } from "./Grid";
import type { PathPoint } from "../sprites/enemies/Enemy";

export function getPathFromSpawnToGoal(): PathPoint[] {
  // For backward compatibility, return the first spawn path
  const allPaths = getAllSpawnPaths();
  return allPaths.length > 0 ? allPaths[0] : [];
}

export function getAllSpawnPaths(): PathPoint[][] {
  // Find all spawn positions and goal position
  const spawnPoints: Array<[number, number]> = [];
  let goalRow = -1;
  let goalCol = -1;

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const kind = demoMap[r][c] as TileKind;
      if (kind === "spawn") {
        spawnPoints.push([r, c]);
      } else if (kind === "goal") {
        goalRow = r;
        goalCol = c;
      }
    }
  }

  if (spawnPoints.length === 0 || goalRow === -1) {
    console.error("Spawn or goal not found!");
    return [];
  }

  // Build paths for each spawn point
  const allPaths: PathPoint[][] = [];
  
  for (const [spawnRow, spawnCol] of spawnPoints) {
    const path: PathPoint[] = [];
    
    // Find path tiles in order from spawn to goal (BFS includes goal but not spawn)
    const pathTiles = findPathTiles(spawnRow, spawnCol, goalRow, goalCol);
    
    if (pathTiles.length === 0) {
      console.error(`No path found from spawn (${spawnRow}, ${spawnCol}) to goal!`);
      // Fallback: just add spawn and goal
      const spawnWorld = tileToWorldCenter(spawnCol, spawnRow);
      const goalWorld = tileToWorldCenter(goalCol, goalRow);
      path.push({ x: spawnWorld.x, y: spawnWorld.y });
      path.push({ x: goalWorld.x, y: goalWorld.y });
    } else {
      // Add spawn point first
      const spawnWorld = tileToWorldCenter(spawnCol, spawnRow);
      path.push({ x: spawnWorld.x, y: spawnWorld.y });
      
      // Convert path tiles to world coordinates (BFS path already includes goal)
      for (const [col, row] of pathTiles) {
        const world = tileToWorldCenter(col, row);
        path.push({ x: world.x, y: world.y });
      }
    }
    
    allPaths.push(path);
  }

  return allPaths;
}

function findPathTiles(startRow: number, startCol: number, endRow: number, endCol: number): Array<[number, number]> {
  // Simple pathfinding: follow the path tiles from spawn to goal
  // Since the path is predefined, we can use a simple BFS or follow the path structure
  
  const visited = new Set<string>();
  
  // Collect all path tiles
  const allPathTiles: Array<[number, number]> = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const kind = demoMap[r][c] as TileKind;
      if (kind === "path" || kind === "spawn" || kind === "goal") {
        allPathTiles.push([c, r]);
      }
    }
  }

  // Use BFS to find path from start to end
  const queue: Array<{ row: number; col: number; path: Array<[number, number]> }> = [];
  queue.push({ row: startRow, col: startCol, path: [] });
  visited.add(`${startRow},${startCol}`);

  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]]; // up, down, left, right

  while (queue.length > 0) {
    const current = queue.shift()!;
    
    if (current.row === endRow && current.col === endCol) {
      return current.path;
    }

    for (const [dr, dc] of directions) {
      const newRow = current.row + dr;
      const newCol = current.col + dc;
      const key = `${newRow},${newCol}`;

      if (
        newRow >= 0 && newRow < GRID_ROWS &&
        newCol >= 0 && newCol < GRID_COLS &&
        !visited.has(key)
      ) {
        const kind = demoMap[newRow][newCol] as TileKind;
        if (kind === "path" || kind === "spawn" || kind === "goal") {
          visited.add(key);
          queue.push({
            row: newRow,
            col: newCol,
            path: [...current.path, [newCol, newRow]]
          });
        }
      }
    }
  }

  return [];
}
