export const TILE_SIZE = 48;
export const GRID_COLS = 26; // 23 + 3
export const GRID_ROWS = 17; // 14 + 3

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

export const map2: TileKind[][] = (() => {

    const map: TileKind[][] = Array.from({ length: GRID_ROWS }, () => Array.from({ length: GRID_COLS }, () => "buildable" as TileKind));


    const pathCoords: Array<[number, number]> = [];

    // Path from top left entrance (row 1, col 0)
    // Goes right, then down to row 7 where paths converge
    for (let c = 0; c < 10; c++) pathCoords.push([c, 1]); // Horizontal right
    for (let r = 1; r < 7; r++) pathCoords.push([10, r]); // Vertical down to row 7
    
    // Path from bottom left entrance (row 12, col 0)
    // Goes right, then up to row 7 where paths converge
    for (let c = 0; c < 9; c++) pathCoords.push([c, 12]); // Horizontal right
    for (let r = 12; r > 7; r--) pathCoords.push([9, r]); // Vertical up to row 7
    
    // Converged path at row 7 continues right to goal
    for (let c = 9; c < GRID_COLS - 1; c++) pathCoords.push([c, 7]); // Main path to goal at row 7

    // Create a set for quick path lookup
    const pathSet = new Set<string>();
    for (const [c, r] of pathCoords) {
        map[r][c] = "path";
        pathSet.add(`${r},${c}`);
    }

    // Two spawn points
    map[1][0] = "spawn";  // Top left entrance
    map[12][0] = "spawn"; // Bottom left entrance
    
    // Goal on the right side at row 7 (where paths converged)
    map[7][GRID_COLS - 2] = "goal"; // Goal at row 7

    // Block tiles covered by top spawn sprite (3x3 area)
    // Top spawn is at row 1, col 0 - sprite covers rows 0-2, cols 0-2
    for (let r = 0; r <= 2; r++) {
        for (let c = 0; c <= 2 && c < GRID_COLS; c++) {
            if (r >= 0 && r < GRID_ROWS && map[r][c] === "buildable") {
                map[r][c] = "blocked";
            }
        }
    }

    // Block tiles covered by bottom spawn sprite (3x3 area)
    // Bottom spawn is at row 12, col 0 - sprite covers rows 11-13, cols 0-2
    for (let r = 11; r <= 13; r++) {
        for (let c = 0; c <= 2 && c < GRID_COLS; c++) {
            if (r >= 0 && r < GRID_ROWS && map[r][c] === "buildable") {
                map[r][c] = "blocked";
            }
        }
    }

    // Block tiles covered by goal sprite (3x3 area)
    // Goal is at row 7, col GRID_COLS - 2 (24) - sprite covers rows 6-8, cols 23-25
    const goalRow = 7;
    const goalCol = GRID_COLS - 2; // 24
    for (let r = goalRow - 1; r <= goalRow + 1; r++) {
        for (let c = goalCol - 1; c <= goalCol + 1; c++) {
            if (r >= 0 && r < GRID_ROWS && c >= 0 && c < GRID_COLS && map[r][c] === "buildable") {
                map[r][c] = "blocked";
            }
        }
    }

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
            
            // Skip last column (GRID_COLS - 1) - reserved for tower selection dropdown
            if (c === GRID_COLS - 1) continue;
            
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
