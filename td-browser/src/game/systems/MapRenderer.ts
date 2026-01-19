import Phaser from "phaser";
import { GRID_COLS, GRID_ROWS, TILE_SIZE, type TileKind } from "../data/map2";

export class MapRenderer {
  private scene: Phaser.Scene;
  private map: TileKind[][];
  private mapTileSprites: Phaser.GameObjects.Sprite[][] = [];
  private frame6Sprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private frame7Sprites: Map<string, Phaser.GameObjects.Sprite> = new Map();

  constructor(scene: Phaser.Scene, map: TileKind[][]) {
    this.scene = scene;
    this.map = map;
  }

  render() {
    this.drawTiles();
    this.drawGrid();
  }

  removeFrame6Sprite(row: number, col: number): boolean {
    const key = `${row},${col}`;
    const sprite = this.frame6Sprites.get(key);
    if (sprite) {
      sprite.destroy();
      this.frame6Sprites.delete(key);
      return true;
    }
    return false;
  }

  removeFrame7Sprite(row: number, col: number): boolean {
    const key = `${row},${col}`;
    const sprite = this.frame7Sprites.get(key);
    if (sprite) {
      sprite.destroy();
      this.frame7Sprites.delete(key);
      return true;
    }
    return false;
  }

  private drawGrid() {
    const g = this.scene.add.graphics();
    g.lineStyle(1, 0x2a2a2a, 1);

    // vertical lines
    for (let c = 0; c <= GRID_COLS; c++) {
      const x = c * TILE_SIZE;
      g.lineBetween(x, 0, x, GRID_ROWS * TILE_SIZE);
    }

    // horizontal lines
    for (let r = 0; r <= GRID_ROWS; r++) {
      const y = r * TILE_SIZE;
      g.lineBetween(0, y, GRID_COLS * TILE_SIZE, y);
    }
  }

  private drawTiles() {
    const hasSprites = this.scene.textures.exists("map-sprites");
    
    if (hasSprites) {
      this.mapTileSprites = [];
      
      // Step 1: Draw grass (frame 0) for all tiles except path tiles
      for (let r = 0; r < GRID_ROWS; r++) {
        this.mapTileSprites[r] = [];
        for (let c = 0; c < GRID_COLS; c++) {
          const kind = this.map[r][c] as TileKind;
          const x = c * TILE_SIZE;
          const y = r * TILE_SIZE;
          
          if (kind !== "path") {
            try {
              const grassSprite = this.scene.add.sprite(x, y, "map-sprites", 0);
              grassSprite.setOrigin(0, 0);
              grassSprite.setDisplaySize(TILE_SIZE, TILE_SIZE);
              grassSprite.setDepth(0);
              this.mapTileSprites[r][c] = grassSprite;
            } catch (error) {
              console.error(`Error creating grass sprite for tile [${r},${c}]:`, error);
            }
          }
        }
      }
      
      // Step 2: Draw path tiles (frame 1) on top of grass
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          const kind = this.map[r][c] as TileKind;
          const x = c * TILE_SIZE;
          const y = r * TILE_SIZE;
          
          if (kind === "path") {
            try {
              const pathSprite = this.scene.add.sprite(x, y, "map-sprites", 1);
              pathSprite.setOrigin(0, 0);
              pathSprite.setDisplaySize(TILE_SIZE, TILE_SIZE);
              pathSprite.setDepth(0);
              this.mapTileSprites[r][c] = pathSprite;
            } catch (error) {
              console.error(`Error creating path sprite for tile [${r},${c}]:`, error);
            }
          }
        }
      }
      
      // Step 2.5: Draw spawn tiles (frame 5)
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          const kind = this.map[r][c] as TileKind;
          
          if (kind === "spawn") {
            try {
              const x = (c * TILE_SIZE) - TILE_SIZE;
              const y = (r * TILE_SIZE) - TILE_SIZE - 20;
              
              const spawnSprite = this.scene.add.sprite(x, y, "map-sprites", 5);
              spawnSprite.setOrigin(0, 0);
              spawnSprite.setDisplaySize(TILE_SIZE * 3, TILE_SIZE * 3);
              spawnSprite.setDepth(1);
            } catch (error) {
              console.error(`Error creating spawn sprite for tile [${r},${c}]:`, error);
            }
          }
        }
      }
      
      // Step 2.6: Draw goal tiles (frame 4)
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          const kind = this.map[r][c] as TileKind;
          
          if (kind === "goal") {
            try {
              const x = (c * TILE_SIZE) - TILE_SIZE;
              const y = (r * TILE_SIZE) - TILE_SIZE - 20;
              
              const goalSprite = this.scene.add.sprite(x, y, "map-sprites", 4);
              goalSprite.setOrigin(0, 0);
              goalSprite.setDisplaySize(TILE_SIZE * 3, TILE_SIZE * 3);
              goalSprite.setDepth(1);
            } catch (error) {
              console.error(`Error creating goal sprite for tile [${r},${c}]:`, error);
            }
          }
        }
      }
      
      // Step 2.7: Add frame 6 sprites to some buildable tiles (at least 5)
      const buildableTiles: Array<[number, number]> = [];
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          const kind = this.map[r][c] as TileKind;
          if (kind === "buildable") {
            buildableTiles.push([r, c]);
          }
        }
      }
      
      const numFrame6Tiles = Math.min(buildableTiles.length, Math.max(5, Math.floor(buildableTiles.length * 0.1)));
      const shuffledBuildable = [...buildableTiles].sort(() => Math.random() - 0.5);
      
      for (let i = 0; i < numFrame6Tiles; i++) {
        const [r, c] = shuffledBuildable[i];
        try {
          const x = c * TILE_SIZE;
          const y = r * TILE_SIZE;
          
          const frame6Sprite = this.scene.add.sprite(x, y, "map-sprites", 6);
          frame6Sprite.setOrigin(0, 0);
          frame6Sprite.setDisplaySize(TILE_SIZE, TILE_SIZE);
          frame6Sprite.setDepth(1);
          
          this.frame6Sprites.set(`${r},${c}`, frame6Sprite);
        } catch (error) {
          console.error(`Error creating frame 6 sprite for tile [${r},${c}]:`, error);
        }
      }
      
      // Step 2.8: Add frame 7 sprites to buildable tiles adjacent to path
      const pathSet = new Set<string>();
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          const kind = this.map[r][c] as TileKind;
          if (kind === "path" || kind === "spawn" || kind === "goal") {
            pathSet.add(`${r},${c}`);
          }
        }
      }
      
      const isAdjacentToPath = (row: number, col: number): boolean => {
        const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dr, dc] of directions) {
          const newRow = row + dr;
          const newCol = col + dc;
          if (newRow >= 0 && newRow < GRID_ROWS && newCol >= 0 && newCol < GRID_COLS) {
            if (pathSet.has(`${newRow},${newCol}`)) {
              return true;
            }
          }
        }
        return false;
      };
      
      const pathAdjacentBuildable: Array<[number, number]> = [];
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          const kind = this.map[r][c] as TileKind;
          if (kind === "buildable" && isAdjacentToPath(r, c)) {
            if (!this.frame6Sprites.has(`${r},${c}`)) {
              pathAdjacentBuildable.push([r, c]);
            }
          }
        }
      }
      
      const maxFrame7Tiles = 7;
      const numFrame7Tiles = Math.min(pathAdjacentBuildable.length, maxFrame7Tiles);
      const shuffledPathAdjacent = [...pathAdjacentBuildable].sort(() => Math.random() - 0.5);
      
      for (let i = 0; i < numFrame7Tiles; i++) {
        const [r, c] = shuffledPathAdjacent[i];
        try {
          const x = c * TILE_SIZE;
          const y = r * TILE_SIZE;
          
          const frame7Sprite = this.scene.add.sprite(x, y, "map-sprites", 7);
          frame7Sprite.setOrigin(0, 0);
          frame7Sprite.setDisplaySize(TILE_SIZE, TILE_SIZE);
          frame7Sprite.setDepth(1);
          
          this.frame7Sprites.set(`${r},${c}`, frame7Sprite);
        } catch (error) {
          console.error(`Error creating frame 7 sprite for tile [${r},${c}]:`, error);
        }
      }
      
      // Step 3: Overlay sprites on blocked tiles (3-5 stones, rest are trees)
      const excludedTiles = new Set<string>();
      
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          const kind = this.map[r][c] as TileKind;
          
          if (kind === "spawn") {
            for (let sr = r - 1; sr <= r + 1; sr++) {
              for (let sc = Math.max(0, c - 1); sc <= c + 1 && sc < GRID_COLS; sc++) {
                if (sr >= 0 && sr < GRID_ROWS) {
                  excludedTiles.add(`${sr},${sc}`);
                }
              }
            }
          } else if (kind === "goal") {
            for (let gr = r - 1; gr <= r + 1; gr++) {
              for (let gc = c - 1; gc <= c + 1; gc++) {
                if (gr >= 0 && gr < GRID_ROWS && gc >= 0 && gc < GRID_COLS) {
                  excludedTiles.add(`${gr},${gc}`);
                }
              }
            }
          }
        }
      }
      
      const blockedTiles: Array<[number, number]> = [];
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          const kind = this.map[r][c] as TileKind;
          if (kind === "blocked" && !excludedTiles.has(`${r},${c}`)) {
            blockedTiles.push([r, c]);
          }
        }
      }
      
      const numStones = Math.min(blockedTiles.length, Math.floor(Math.random() * 3) + 3);
      const shuffledBlocked = [...blockedTiles].sort(() => Math.random() - 0.5);
      const stoneTiles = new Set<string>();
      
      for (let i = 0; i < numStones; i++) {
        const [r, c] = shuffledBlocked[i];
        stoneTiles.add(`${r},${c}`);
      }
      
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          const kind = this.map[r][c] as TileKind;
          const x = c * TILE_SIZE;
          const y = r * TILE_SIZE;
          
          if (kind === "blocked" && !excludedTiles.has(`${r},${c}`)) {
            try {
              const isStone = stoneTiles.has(`${r},${c}`);
              const frameIndex = isStone ? 3 : 2;
              
              const sprite = this.scene.add.sprite(x, y, "map-sprites", frameIndex);
              sprite.setOrigin(0, 0);
              sprite.setDisplaySize(TILE_SIZE, TILE_SIZE);
              sprite.setDepth(1);
            } catch (error) {
              console.error(`Error creating blocked sprite for tile [${r},${c}]:`, error);
            }
          }
        }
      }
    } else {
      // Fallback to colored rectangles
      const g = this.scene.add.graphics();
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          const kind = this.map[r][c] as TileKind;
          const color = this.kindToColor(kind);
          g.fillStyle(color, 1);

          const x = c * TILE_SIZE;
          const y = r * TILE_SIZE;
          g.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        }
      }
      g.setAlpha(0.7);
    }
  }

  private kindToColor(kind: TileKind): number {
    switch (kind) {
      case "buildable":
        return 0x245c2c;
      case "path":
        return 0x7a5c2e;
      case "blocked":
        return 0x444444;
      case "spawn":
        return 0x2e4f7a;
      case "goal":
        return 0x7a2e2e;
      default:
        return 0x000000;
    }
  }
}
