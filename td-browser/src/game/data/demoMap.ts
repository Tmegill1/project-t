export const TILE_SIZE = 48;
export const GRID_COLS = 23;
export const GRID_ROWS = 14;

export type TileKind = "buildable" | "path" | "blocked" | "spawn" | "goal";

// Helper function to check if a coordinate is adjacent to a path tile
function isAdjacentToPath(row: number, col: number, pathSet: Set<string>): boolean {
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]]; // up, down, left, right
    for (const [dr, dc] of directions) {
        const newRow = row + dr;
        const newCol = col + dc;
        // Check bounds before checking pathSet
        if (newRow >= 0 && newRow < GRID_ROWS && newCol >= 0 && newCol < GRID_COLS) {
            if (pathSet.has(`${newRow},${newCol}`)) {
                return true;
            }
        }
    }
    return false;
}

export const demoMap: TileKind[][] = (() => {

    const map: TileKind[][] = Array.from({ length: GRID_ROWS }, () => Array.from({ length: GRID_COLS }, () => "buildable" as TileKind));


    const pathCoords: Array<[number, number]> = [];

    // Updated path for new map size
    for (let c = 0; c < 17; c++) pathCoords.push([c, 4]);
    for (let r = 4; r < 8; r++) pathCoords.push([16, r]);
    for (let c = 16; c > 3; c--) pathCoords.push([c, 8]);
    for (let r = 8; r < 11; r++) pathCoords.push([4, r]);
    for (let c = 4; c < GRID_COLS; c++) pathCoords.push([c, 10]);

    // Create a set for quick path lookup
    const pathSet = new Set<string>();
    for (const [c, r] of pathCoords) {
        map[r][c] = "path";
        pathSet.add(`${r},${c}`);
    }

    map[4][0] = "spawn";  // Start of path on left side
    map[10][GRID_COLS - 1] = "goal";

    // Find all tiles adjacent to path and tiles farther away
    // Exclude top row (row 0) where UI is displayed
    const adjacentTiles: Array<[number, number]> = [];
    const distantTiles: Array<[number, number]> = [];
    
    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            // Skip if it's already a path, spawn, or goal
            if (map[r][c] !== "buildable") continue;
            
            // Skip top row (row 0) - reserved for UI
            if (r === 0) continue;
            
            if (isAdjacentToPath(r, c, pathSet)) {
                adjacentTiles.push([r, c]);
            } else {
                distantTiles.push([r, c]);
            }
        }
    }

    // Place blocked tiles: max 5 adjacent to path, max 7 farther away, max 12 total
    const maxAdjacentBlocked = 5;
    const maxDistantBlocked = 7;
    const maxTotalBlocked = 12;
    
    // Shuffle and select random tiles to block
    const shuffledAdjacent = [...adjacentTiles].sort(() => Math.random() - 0.5);
    const shuffledDistant = [...distantTiles].sort(() => Math.random() - 0.5);
    
    let blockedCount = 0;
    
    // Block up to 5 tiles adjacent to path
    const adjacentBlocked = Math.min(maxAdjacentBlocked, shuffledAdjacent.length);
    for (let i = 0; i < adjacentBlocked; i++) {
        const [r, c] = shuffledAdjacent[i];
        map[r][c] = "blocked";
        blockedCount++;
        console.log(`Blocked adjacent tile at row ${r}, col ${c}`);
    }
    
    // Block up to 7 tiles farther from path (but ensure total doesn't exceed 12)
    const remainingSlots = maxTotalBlocked - blockedCount;
    const distantBlocked = Math.min(maxDistantBlocked, shuffledDistant.length, remainingSlots);
    for (let i = 0; i < distantBlocked; i++) {
        const [r, c] = shuffledDistant[i];
        map[r][c] = "blocked";
        blockedCount++;
        console.log(`Blocked distant tile at row ${r}, col ${c}`);
    }
    
    console.log(`Total blocked tiles: ${blockedCount} (${adjacentBlocked} adjacent, ${distantBlocked} distant)`);

    return map;
})();

