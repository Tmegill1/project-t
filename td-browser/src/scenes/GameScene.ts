import Phaser from "phaser";
import { GRID_COLS, GRID_ROWS, TILE_SIZE, demoMap, type TileKind } from "../game/data/demoMap.ts";
import { tileToWorldCenter } from "../game/map/Grid";
import { getPathFromSpawnToGoal } from "../game/map/PathFinder";
import { CircleEnemy, SquareEnemy, TriangleEnemy } from "../game/sprites/enemies/Enemy";
import { BaseEnemy } from "../game/sprites/enemies/BaseEnemy";
import type { TowerType } from "../ui/towerSelection/TowerSelection";
import { TowerSelection } from "../ui/towerSelection/TowerSelection";
import { GameMenu } from "../ui/gameMenu/GameMenu";
import { BaseTower } from "../game/sprites/towers/BaseTower";
import Projectile from "../game/sprites/towers/Projectile";
import UIScene from "./UIScene";

export default class GameScene extends Phaser.Scene {
  private hoverRect?: Phaser.GameObjects.Rectangle;
  private selectRect?: Phaser.GameObjects.Rectangle;
  private debugText?: Phaser.GameObjects.Text;
  private enemies!: Phaser.GameObjects.Group;
  private enemyPath!: Array<{ x: number; y: number }>;
  private towers!: Phaser.GameObjects.Group;
  private projectiles!: Phaser.GameObjects.Group;
  private isDraggingTower: boolean = false;
  private selectedTower: BaseTower | null = null;
  private towerPlacementPreview?: Phaser.GameObjects.Rectangle;
  private towerSelection?: TowerSelection;
  private selectedTowerType: TowerType | null = null;
  private currentWave: number = 1;
  private isWaveActive: boolean = false;
  private enemiesRemainingInWave: number = 0;
  private isGameOver: boolean = false;
  private gameOverMenu?: Phaser.GameObjects.Container;
  private gameMenu?: GameMenu;
  private isPaused: boolean = false;
  private sellButton?: Phaser.GameObjects.Rectangle;
  private sellButtonText?: Phaser.GameObjects.Text;
  private mapTileSprites: Phaser.GameObjects.Sprite[][] = [];

  constructor() {
    super("Game");
  }

  create() {
    try {
      console.log("GameScene: Starting create()");
      
      // Reset game state
      this.isGameOver = false;
      this.currentWave = 1;
      this.isWaveActive = false;
      this.enemiesRemainingInWave = 0;
      this.selectedTowerType = null;
      this.isDraggingTower = false;
      this.selectedTower = null;
      // Hide sell button if it exists
      this.hideSellButton();
      
      // Clear game over menu if it exists
      if (this.gameOverMenu) {
        this.gameOverMenu.destroy();
        this.gameOverMenu = undefined;
      }
      
      // Ensure input is enabled
      this.input.enabled = true;
      this.input.setPollAlways();
      
      // World setup
      this.cameras.main.setBackgroundColor("#111111");

      // Draw the map (order matters: tiles first, then grid)
      this.drawTiles();
      this.drawGrid();

      // Initialize enemy system
      this.enemies = this.add.group();
      console.log("GameScene: Getting path from spawn to goal");
      this.enemyPath = getPathFromSpawnToGoal();
      console.log("GameScene: Path found, length:", this.enemyPath.length);
    
      // Initialize tower and projectile systems
      this.towers = this.add.group();
      this.projectiles = this.add.group();
      
      // Create tower selection dropdown menu
      try {
        this.towerSelection = new TowerSelection(this, (towerType: TowerType | null) => {
          this.selectedTowerType = towerType;
          this.isDraggingTower = towerType !== null;
          if (towerType) {
            console.log("Tower type selected for placement");
            if (this.debugText) {
              this.debugText.setText("Tower selected! Click a buildable tile to place.");
            }
          } else {
            this.isDraggingTower = false;
            if (this.debugText) {
              this.debugText.setText("Click a tile");
            }
          }
        });
        console.log("GameScene: Tower selection created");
      } catch (error) {
        console.error("Error creating tower selection:", error);
      }
    
    // Create game menu (pause menu)
    try {
      this.gameMenu = new GameMenu(
        this,
        () => {
          // Continue callback
          this.isPaused = false;
        },
        () => {
          // Restart callback
          this.restartGame();
        },
        () => {
          // Quit callback
          this.goHome();
        },
        (isPaused: boolean) => {
          // Pause state change callback
          this.isPaused = isPaused;
        }
      );
      
      // Setup Escape key handler - only show menu if nothing else is selected
      this.gameMenu.setupEscapeKey(() => {
        // Can show menu if:
        // - Game is not over
        // - Tower dropdown is not open
        // - No tower is currently selected for placement
        const towerSelectionOpen = this.towerSelection?.getIsDropdownOpen() || false;
        return !this.isGameOver && !towerSelectionOpen && !this.isDraggingTower;
      });
      
      console.log("GameScene: Game menu created");
    } catch (error) {
      console.error("Error creating game menu:", error);
    }
    
    // Remove only our specific event listeners to prevent duplicates on restart
    this.events.off("enemy-reached-goal");
    this.events.off("enemy-killed");
    this.events.off("game-over");
    
    // Listen for enemy reaching goal
    this.events.on("enemy-reached-goal", (lifeLoss: number) => {
      // Notify UI scene with life loss amount
      this.scene.get("UI").events.emit("enemy-reached-goal", lifeLoss);
    });
    
    // Listen for enemy killed (reward money)
    this.events.on("enemy-killed", (reward: number) => {
      // Notify UI scene to add money
      const uiScene = this.scene.get("UI") as UIScene;
      uiScene.addMoney(reward);
    });
    
    // Listen for game over
    this.events.on("game-over", () => {
      this.showGameOverMenu();
    });

    // Start wave 1 after 2 seconds
    this.time.delayedCall(2000, () => {
      this.startWave(this.currentWave);
    });

    // Hover + selection indicators
    this.hoverRect = this.add
      .rectangle(0, 0, TILE_SIZE, TILE_SIZE)
      .setStrokeStyle(2, 0xffff00, 0.9)
      .setVisible(false);

    this.selectRect = this.add
      .rectangle(0, 0, TILE_SIZE, TILE_SIZE)
      .setStrokeStyle(3, 0x00ffcc, 0.95)
      .setVisible(false);

    this.debugText = this.add
      .text(300, 100, "Click a tile", { fontSize: "16px", color: "#ffffff" })
      .setScrollFactor(0)
      .setOrigin(0.5);

    // Input
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      const { col, row, inBounds } = this.worldToTile(p.worldX, p.worldY);
      if (!inBounds || !this.hoverRect) {
        this.hoverRect?.setVisible(false);
        return;
      }
      const c = tileToWorldCenter(col, row);
      this.hoverRect.setPosition(c.x, c.y).setVisible(true);
    });

      this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
        // Don't handle game input if paused or game over
        if (this.isPaused || this.isGameOver) {
          return;
        }
        
        console.log(`Pointer down at world: (${p.worldX}, ${p.worldY}), screen: (${p.x}, ${p.y}), isDraggingTower: ${this.isDraggingTower}`);
        
        // Check if clicking on tower selection dropdown
        if (this.towerSelection && this.towerSelection.handleClick(p.worldX, p.worldY)) {
          return;
        }
        
        // Handle tower placement FIRST (if tower type was already selected)
      if (this.isDraggingTower) {
        console.log("isDraggingTower is TRUE - processing placement");
        
        // Don't place if clicking on an existing tower
        let clickedExistingTower = false;
        for (const child of this.towers.children.entries) {
          if (child instanceof BaseTower) {
            const bounds = child.getBounds();
            if (bounds && Phaser.Geom.Rectangle.Contains(bounds, p.worldX, p.worldY)) {
              console.log("Clicked existing tower - canceling placement");
              clickedExistingTower = true;
              this.isDraggingTower = false;
              break;
            }
          }
        }
        
        if (clickedExistingTower) {
          return;
        }
        
        const { col, row, inBounds } = this.worldToTile(p.worldX, p.worldY);
        console.log(`Attempting to place tower at tile: (${col}, ${row}), inBounds: ${inBounds}, worldX: ${p.worldX}, worldY: ${p.worldY}`);
        if (inBounds) {
          const kind = demoMap[row][col] as TileKind;
          const hasTower = this.hasTowerAt(col, row);
          console.log(`Selected tile: (${col}, ${row}) - kind=${kind}, hasTower: ${hasTower}`);
          if (kind === "buildable" && !hasTower) {
            // Get selected tower type from tower selection
            if (!this.selectedTowerType) {
              console.log("No tower type selected");
              return;
            }
            
            const towerType = this.selectedTowerType;
            const towerCost = (towerType as any).COST || 0;
            
            // Check if player can afford the tower
            const uiScene = this.scene.get("UI") as UIScene;
            if (!uiScene.canAfford(towerCost)) {
              console.log(`✗ Cannot place tower - insufficient funds (need ${towerCost}, have ${uiScene.getMoney()})`);
              if (this.debugText) {
                this.debugText.setText(`Not enough money! Need ${towerCost}, have ${uiScene.getMoney()}`);
              }
            } else {
              console.log("✓ Conditions met - creating tower now!");
              try {
                console.log(`Creating Tower at col=${col}, row=${row}`);
                const tower = new towerType(this, col, row);
                console.log("Tower object created:", tower);
                this.towers.add(tower);
                // Deduct money after successful tower placement
                this.scene.get("UI").events.emit("purchase-tower", towerCost);
                console.log(`✓ Tower added to group. Total towers: ${this.towers.children.size}`);
                console.log(`Tower position: x=${tower.x}, y=${tower.y}, col=${tower.getCol()}, row=${tower.getRow()}`);
              } catch (error) {
                console.error("✗ Error creating tower:", error);
                console.error("Error stack:", (error as Error).stack);
              }
            }
          } else {
            console.log(`✗ Cannot place tower - kind=${kind} (needs 'buildable'), hasTower=${hasTower}`);
          }
        } else {
          console.log(`✗ Click out of bounds - col: ${col}, row: ${row}, GRID_COLS: ${GRID_COLS}, GRID_ROWS: ${GRID_ROWS}`);
        }
        this.isDraggingTower = false;
        if (this.towerPlacementPreview) {
          this.towerPlacementPreview.destroy();
          this.towerPlacementPreview = undefined;
        }
        // Reset debug text
        if (this.debugText) {
          this.debugText.setText("Click a tile");
        }
        return;
      }
      
      // Check if clicking on sell button first
      if (this.sellButton) {
        const sellButtonBounds = this.sellButton.getBounds();
        if (sellButtonBounds && Phaser.Geom.Rectangle.Contains(sellButtonBounds, p.worldX, p.worldY)) {
          // Sell button click is handled by its own pointerdown listener
          return;
        }
      }

      // Convert click position to tile coordinates
      const { col, row, inBounds } = this.worldToTile(p.worldX, p.worldY);
      
      // Check if clicking on a tile with a tower (select by tile location)
      if (inBounds) {
        const towerAtTile = this.getTowerAt(col, row);
        if (towerAtTile) {
          // Select tower and show range
          if (this.selectedTower) {
            this.selectedTower.hideRange();
          }
          this.selectedTower = towerAtTile;
          towerAtTile.showRange();
          // Show sell button for selected tower
          this.showSellButton(towerAtTile);
          // Cancel tower placement if selecting an existing tower
          this.isDraggingTower = false;
          if (this.towerPlacementPreview) {
            this.towerPlacementPreview.destroy();
            this.towerPlacementPreview = undefined;
          }
          return;
        }
      }
      
      // Fallback: Check if clicking directly on a tower visual (for edge cases)
      for (const child of this.towers.children.entries) {
        if (child instanceof BaseTower) {
          const bounds = child.getBounds();
          if (bounds && Phaser.Geom.Rectangle.Contains(bounds, p.worldX, p.worldY)) {
            // Select tower and show range
            if (this.selectedTower) {
              this.selectedTower.hideRange();
            }
            this.selectedTower = child;
            child.showRange();
            // Show sell button for selected tower
            this.showSellButton(child);
            // Cancel tower placement if selecting an existing tower
            this.isDraggingTower = false;
            if (this.towerPlacementPreview) {
              this.towerPlacementPreview.destroy();
              this.towerPlacementPreview = undefined;
            }
            return;
          }
        }
      }
      
      // Deselect tower if clicking elsewhere
      if (this.selectedTower) {
        this.selectedTower.hideRange();
        this.selectedTower = null;
        this.hideSellButton();
      }
      console.log(`Regular click at tile: (${col}, ${row}), inBounds: ${inBounds}`);
      
      if (!inBounds || !this.selectRect) {
        console.log("Click out of bounds or selectRect not available");
        return;
      }

      const c = tileToWorldCenter(col, row);
      this.selectRect.setPosition(c.x, c.y).setVisible(true);

      const kind = demoMap[row][col] as TileKind;
      console.log(`Selected tile: (${col}, ${row}) - kind=${kind}`);
      this.debugText?.setText(`Selected: (${col}, ${row}) kind=${kind}`);
    });
    
    console.log("GameScene: create() completed successfully");
    } catch (error) {
      console.error("GameScene: Error in create():", error);
      throw error;
    }
    
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      // Show hover rect (normal tile hover)
      const { col, row, inBounds } = this.worldToTile(p.worldX, p.worldY);
      if (!inBounds || !this.hoverRect) {
        this.hoverRect?.setVisible(false);
        return;
      }
      const c = tileToWorldCenter(col, row);
      this.hoverRect.setPosition(c.x, c.y).setVisible(true);
    });
  }

  private drawGrid() {
    const g = this.add.graphics();
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

  /**
   * Calculates frame index from row and column position in sprite sheet
   * @param row - Row number (0-indexed, top row is 0)
   * @param col - Column number (0-indexed, left column is 0)
   * @param tilesPerRow - Number of tiles per row in the sprite sheet
   * @returns Frame index
   * 
   * Example: If your sprite sheet has 16 tiles per row (1024px / 64px = 16),
   * and the cave is at row 2, column 5: frame = (2 * 16) + 5 = 37
   */
  private calculateFrameIndex(row: number, col: number, tilesPerRow: number): number {
    return (row * tilesPerRow) + col;
  }


  private drawTiles() {
    // Check if map sprites are loaded
    const hasSprites = this.textures.exists("map-sprites");
    
    // Debug: Log texture information
    if (hasSprites) {
      const texture = this.textures.get("map-sprites");
      const source = texture.source[0];
      console.log("Map sprites texture loaded:", {
        key: texture.key,
        frameTotal: texture.frameTotal,
        width: source ? source.width : "unknown",
        height: source ? source.height : "unknown",
        source: texture.source
      });
      
      // Log available frames
      if (texture.frameTotal > 0) {
        console.log(`Available frames: 0 to ${texture.frameTotal - 1}`);
        for (let i = 0; i < Math.min(10, texture.frameTotal); i++) {
          const frame = texture.get(i);
          if (frame) {
            console.log(`Frame ${i}:`, {
              width: frame.width,
              height: frame.height,
              x: frame.cutX,
              y: frame.cutY
            });
          }
        }
      }
    } else {
      console.warn("Map sprites texture 'map-sprites' not found! Falling back to colored rectangles.");
      console.warn("Available textures:", this.textures.list);
    }
    
    // Initialize 2D array for tile sprites
    this.mapTileSprites = [];
    
    if (hasSprites) {
      // Initialize 2D array for tile sprites
      this.mapTileSprites = [];
      
      // Step 1: Draw grass (frame 0) for all tiles except path tiles
      for (let r = 0; r < GRID_ROWS; r++) {
        this.mapTileSprites[r] = [];
        for (let c = 0; c < GRID_COLS; c++) {
          const kind = demoMap[r][c] as TileKind;
          const x = c * TILE_SIZE;
          const y = r * TILE_SIZE;
          
          // Draw grass for all non-path tiles
          if (kind !== "path") {
            try {
              const grassSprite = this.add.sprite(x, y, "map-sprites", 0); // Frame 0 = grass
              grassSprite.setOrigin(0, 0);
              grassSprite.setDisplaySize(TILE_SIZE, TILE_SIZE);
              grassSprite.setDepth(0); // Base layer
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
          const kind = demoMap[r][c] as TileKind;
          const x = c * TILE_SIZE;
          const y = r * TILE_SIZE;
          
          if (kind === "path") {
            try {
              const pathSprite = this.add.sprite(x, y, "map-sprites", 1); // Frame 1 = path
              pathSprite.setOrigin(0, 0);
              pathSprite.setDisplaySize(TILE_SIZE, TILE_SIZE);
              pathSprite.setDepth(0); // Same depth as grass
              this.mapTileSprites[r][c] = pathSprite;
            } catch (error) {
              console.error(`Error creating path sprite for tile [${r},${c}]:`, error);
            }
          }
        }
      }
      
      // Step 3: Overlay sprites on blocked tiles (3-5 stones, rest are trees)
      // First, collect all blocked tile positions
      const blockedTiles: Array<[number, number]> = [];
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          const kind = demoMap[r][c] as TileKind;
          if (kind === "blocked") {
            blockedTiles.push([r, c]);
          }
        }
      }
      
      // Randomly select 3-5 blocked tiles for stones
      const numStones = Math.min(blockedTiles.length, Math.floor(Math.random() * 3) + 3); // 3-5 stones
      const shuffledBlocked = [...blockedTiles].sort(() => Math.random() - 0.5);
      const stoneTiles = new Set<string>();
      
      for (let i = 0; i < numStones; i++) {
        const [r, c] = shuffledBlocked[i];
        stoneTiles.add(`${r},${c}`);
      }
      
      // Now overlay sprites on blocked tiles
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          const kind = demoMap[r][c] as TileKind;
          const x = c * TILE_SIZE;
          const y = r * TILE_SIZE;
          
          if (kind === "blocked") {
            try {
              const isStone = stoneTiles.has(`${r},${c}`);
              const frameIndex = isStone ? 3 : 2; // Frame 3 = stone, Frame 2 = tree
              
              const sprite = this.add.sprite(x, y, "map-sprites", frameIndex);
              sprite.setOrigin(0, 0);
              sprite.setDisplaySize(TILE_SIZE, TILE_SIZE);
              sprite.setDepth(1); // On top of grass
            } catch (error) {
              const spriteType = stoneTiles.has(`${r},${c}`) ? "stone" : "tree";
              console.error(`Error creating ${spriteType} sprite for tile [${r},${c}]:`, error);
            }
          }
        }
      }
      
      console.log(`Placed ${numStones} stone sprites and ${blockedTiles.length - numStones} tree sprites on blocked tiles`);
      
      console.log(`Created ${this.mapTileSprites.flat().length} base tile sprites`);
    } else {
      // Fallback to colored rectangles if sprites aren't loaded
      const g = this.add.graphics();
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          const kind = demoMap[r][c] as TileKind;
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
        return 0x245c2c; // green-ish
      case "path":
        return 0x7a5c2e; // brown-ish
      case "blocked":
        return 0x444444; // gray
      case "spawn":
        return 0x2e4f7a; // blue
      case "goal":
        return 0x7a2e2e; // red
      default:
        return 0x000000;
    }
  }

  private worldToTile(x: number, y: number) {
    const col = Math.floor(x / TILE_SIZE);
    const row = Math.floor(y / TILE_SIZE);
    const inBounds = col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS;
    return { col, row, inBounds };
  }

  private spawnEnemy(type: "circle" | "square" | "triangle" = "circle") {
    if (this.enemyPath.length === 0) {
      console.error("No path found for enemy!");
      return;
    }

    const startPoint = this.enemyPath[0];
    let enemy: BaseEnemy;

    // Calculate modifiers for waves after 5
    // Wave 6: 110% HP, 105% speed
    // Wave 7: 120% HP, 110% speed
    // etc.
    let healthModifier = 1;
    let speedModifier = 1;
    if (this.currentWave > 5) {
      const wavesOver5 = this.currentWave - 5;
      healthModifier = 1 + (wavesOver5 * 0.10); // +10% per wave
      speedModifier = 1 + (wavesOver5 * 0.05);  // +5% per wave
    }

    switch (type) {
      case "circle":
        enemy = new CircleEnemy(this, startPoint.x, startPoint.y, this.enemyPath, speedModifier, healthModifier, this.currentWave);
        break;
      case "square":
        enemy = new SquareEnemy(this, startPoint.x, startPoint.y, this.enemyPath, speedModifier, healthModifier, this.currentWave);
        break;
      case "triangle":
        enemy = new TriangleEnemy(this, startPoint.x, startPoint.y, this.enemyPath, speedModifier, healthModifier, this.currentWave);
        break;
    }

    this.enemies.add(enemy);
  }

  private startWave(waveNumber: number) {
    if (this.isWaveActive) {
      console.log("Wave already active, cannot start new wave");
      return;
    }

    this.currentWave = waveNumber;
    this.isWaveActive = true;
    console.log(`Starting Wave ${waveNumber}`);

    // Update UI wave counter
    const uiScene = this.scene.get("UI") as UIScene;
    uiScene.setWave(waveNumber);

    // Get wave spawn configuration
    const waveConfig = this.getWaveConfig(waveNumber);
    const totalEnemies = waveConfig.total;
    this.enemiesRemainingInWave = totalEnemies; // Track remaining enemies to spawn
    
    console.log(`Wave ${waveNumber} will spawn ${totalEnemies} enemies:`, waveConfig.spawns);

    // Separate enemies by type
    const circleCount = waveConfig.spawns.find(s => s.type === "circle")?.count || 0;
    const triangleCount = waveConfig.spawns.find(s => s.type === "triangle")?.count || 0;
    const squareCount = waveConfig.spawns.find(s => s.type === "square")?.count || 0;

    const spawnInterval = 500; // 500ms between each enemy spawn
    let enemiesSpawned = 0;

    // Calculate when last circle spawns
    const lastCircleSpawnTime = (circleCount - 1) * spawnInterval; // Time when last circle spawns
    const squareStartAfterLastCircle = lastCircleSpawnTime + 3000; // 3 seconds after last circle
    const squareStartAfterFirstCircle = 10000; // 10 seconds after first circle
    // Use whichever comes first
    const squareStartDelay = Math.min(squareStartAfterLastCircle, squareStartAfterFirstCircle);

    // Spawn circles first at normal rate (starting immediately)
    for (let i = 0; i < circleCount; i++) {
      const spawnDelay = i * spawnInterval;
      this.time.delayedCall(spawnDelay, () => {
        this.spawnEnemy("circle");
        enemiesSpawned++;
        this.enemiesRemainingInWave--;
        
        // Check if all enemies have been spawned
        if (enemiesSpawned >= totalEnemies) {
          // All enemies spawned, now wait for them to be destroyed or reach goal
          this.time.delayedCall(1000, () => {
            this.startWaveCompletionCheck();
          });
        }
      });
    }

    // Start spawning triangles 5 seconds after first circle spawns
    const triangleStartDelay = 5000; // 5 seconds
    for (let i = 0; i < triangleCount; i++) {
      const spawnDelay = triangleStartDelay + (i * spawnInterval);
      this.time.delayedCall(spawnDelay, () => {
        this.spawnEnemy("triangle");
        enemiesSpawned++;
        this.enemiesRemainingInWave--;
        
        // Check if all enemies have been spawned
        if (enemiesSpawned >= totalEnemies) {
          // All enemies spawned, now wait for them to be destroyed or reach goal
          this.time.delayedCall(1000, () => {
            this.startWaveCompletionCheck();
          });
        }
      });
    }

    // Start spawning squares: 10 seconds after first circle OR 3 seconds after last circle (whichever is earlier)
    for (let i = 0; i < squareCount; i++) {
      const spawnDelay = squareStartDelay + (i * spawnInterval);
      this.time.delayedCall(spawnDelay, () => {
        this.spawnEnemy("square");
        enemiesSpawned++;
        this.enemiesRemainingInWave--;
        
        // Check if all enemies have been spawned
        if (enemiesSpawned >= totalEnemies) {
          // All enemies spawned, now wait for them to be destroyed or reach goal
          this.time.delayedCall(1000, () => {
            this.startWaveCompletionCheck();
          });
        }
      });
    }
  }
  
  private startWaveCompletionCheck() {
    // Continuously check if wave is complete
    const checkInterval = this.time.addEvent({
      delay: 500,
      callback: () => {
        // Wave is complete when all enemies have been spawned and none remain on screen
        if (this.isWaveActive && this.enemiesRemainingInWave <= 0 && this.enemies.children.size === 0) {
          checkInterval.destroy();
          this.onWaveComplete();
        }
      },
      loop: true
    });
  }

  private getWaveConfig(waveNumber: number): {
    spawns: Array<{ type: "circle" | "square" | "triangle"; count: number }>;
    total: number;
  } {
    // Wave configurations
    // Wave 1: 5 circles
    // Wave 2: +3 circles, +3 triangles (8 circles, 3 triangles total)
    // Wave 3: +3 circles, +3 triangles (11 circles, 6 triangles total)
    // Wave 4: +2 squares (11 circles, 6 triangles, 2 squares total)
    // Wave 5: +3 circles, +3 triangles, +1 square (14 circles, 9 triangles, 3 squares total)
    // Wave 6+: Wave 5 pattern + (5 circles, 10 triangles, 3 squares) per wave after 5

    const configs: Record<number, Array<{ type: "circle" | "square" | "triangle"; count: number }>> = {
      1: [
        { type: "circle", count: 5 }
      ],
      2: [
        { type: "circle", count: 3 },
        { type: "triangle", count: 3 }
      ],
      3: [
        { type: "circle", count: 3 },
        { type: "triangle", count: 3 }
      ],
      4: [
        { type: "square", count: 2 }
      ],
      5: [
        { type: "circle", count: 3 },
        { type: "triangle", count: 3 },
        { type: "square", count: 1 }
      ]
    };

    // Calculate cumulative spawns up to wave 5
    const spawns: Array<{ type: "circle" | "square" | "triangle"; count: number }> = [];
    let total = 0;

    const effectiveWave = waveNumber > 5 ? 5 : waveNumber;
    for (let w = 1; w <= effectiveWave; w++) {
      if (configs[w]) {
        for (const spawn of configs[w]) {
          const existing = spawns.find(s => s.type === spawn.type);
          if (existing) {
            existing.count += spawn.count;
          } else {
            spawns.push({ ...spawn });
          }
          total += spawn.count;
        }
      }
    }

    // For waves after 5, add extra enemies per wave
    if (waveNumber > 5) {
      const wavesOver5 = waveNumber - 5;
      const extraPerWave = [
        { type: "circle" as const, count: 5 },
        { type: "triangle" as const, count: 10 },
        { type: "square" as const, count: 3 }
      ];

      // Add extra enemies for each wave after 5
      for (let i = 0; i < wavesOver5; i++) {
        for (const extra of extraPerWave) {
          const existing = spawns.find(s => s.type === extra.type);
          if (existing) {
            existing.count += extra.count;
          } else {
            spawns.push({ ...extra });
          }
          total += extra.count;
        }
      }
    }

    return { spawns, total };
  }

  private onWaveComplete() {
    this.isWaveActive = false;
    console.log(`Wave ${this.currentWave} complete!`);
    
    // Continue indefinitely - always start next wave after 3 seconds
    // Game continues until player runs out of lives
    this.time.delayedCall(3000, () => {
      this.startWave(this.currentWave + 1);
    });
  }

  update(time: number, delta: number) {
    // Don't update game if game is over or paused
    if (this.isGameOver || this.isPaused) {
      return;
    }
    
    // Update all enemies
    this.enemies.children.entries.forEach((child) => {
      if (child instanceof BaseEnemy) {
        child.update(time, delta);
      }
    });
    
    // Check if wave is complete (all enemies spawned and none remain)
    if (this.isWaveActive && this.enemiesRemainingInWave <= 0 && this.enemies.children.size === 0) {
      this.onWaveComplete();
    }
    
    // Update all towers
    this.towers.children.entries.forEach((child) => {
      if (child instanceof BaseTower) {
        child.update(time, delta, this.enemies);
      }
    });
    
    // Update all projectiles
    this.projectiles.children.entries.forEach((child) => {
      if (child instanceof Projectile) {
        child.update(time, delta);
      }
    });
  }
  
  private hasTowerAt(col: number, row: number): boolean {
    for (const child of this.towers.children.entries) {
      if (child instanceof BaseTower) {
        if (child.getCol() === col && child.getRow() === row) {
          return true;
        }
      }
    }
    return false;
  }

  private getTowerAt(col: number, row: number): BaseTower | null {
    for (const child of this.towers.children.entries) {
      if (child instanceof BaseTower) {
        if (child.getCol() === col && child.getRow() === row) {
          return child;
        }
      }
    }
    return null;
  }
  
  private showGameOverMenu() {
    if (this.isGameOver || this.gameOverMenu) {
      return; // Already showing game over menu
    }
    
    this.isGameOver = true;
    
    // Stop all game timers
    this.time.removeAllEvents();
    
    // Get screen center
    const centerX = this.cameras.main.width / 2;
    const centerY = this.cameras.main.height / 2;
    
    // Create semi-transparent background overlay (separate from container)
    const overlay = this.add.rectangle(centerX, centerY, this.cameras.main.width, this.cameras.main.height, 0x000000, 0.7);
    overlay.setScrollFactor(0);
    overlay.setDepth(4000);
    
    // Create menu container
    this.gameOverMenu = this.add.container(centerX, centerY);
    this.gameOverMenu.setScrollFactor(0);
    this.gameOverMenu.setDepth(4001);
    
    // "You have lost!" text - big bold font
    const gameOverText = this.add.text(0, -100, "You have lost!", {
      fontSize: "48px",
      color: "#ff0000",
      fontStyle: "bold"
    });
    gameOverText.setOrigin(0.5, 0.5);
    
    // "Thank you for playing!" text
    const thankYouText = this.add.text(0, -30, "Thank you for playing!", {
      fontSize: "24px",
      color: "#ffffff"
    });
    thankYouText.setOrigin(0.5, 0.5);
    
    // "Would you like to" text
    const questionText = this.add.text(0, 20, "Would you like to", {
      fontSize: "20px",
      color: "#ffffff"
    });
    questionText.setOrigin(0.5, 0.5);
    
    // "Play Again" button (left)
    const playAgainButton = this.add.rectangle(-80, 80, 140, 50, 0x00aa00, 1);
    playAgainButton.setStrokeStyle(2, 0xffffff, 1);
    playAgainButton.setInteractive({ useHandCursor: true });
    playAgainButton.on("pointerdown", () => {
      this.restartGame();
    });
    
    const playAgainText = this.add.text(-80, 80, "Play Again", {
      fontSize: "18px",
      color: "#ffffff",
      fontStyle: "bold"
    });
    playAgainText.setOrigin(0.5, 0.5);
    playAgainText.setInteractive({ useHandCursor: true });
    playAgainText.on("pointerdown", () => {
      this.restartGame();
    });
    
    // "Home" button (right)
    const homeButton = this.add.rectangle(80, 80, 140, 50, 0xaa0000, 1);
    homeButton.setStrokeStyle(2, 0xffffff, 1);
    homeButton.setInteractive({ useHandCursor: true });
    homeButton.on("pointerdown", () => {
      this.goHome();
    });
    
    const homeText = this.add.text(80, 80, "Home", {
      fontSize: "18px",
      color: "#ffffff",
      fontStyle: "bold"
    });
    homeText.setOrigin(0.5, 0.5);
    homeText.setInteractive({ useHandCursor: true });
    homeText.on("pointerdown", () => {
      this.goHome();
    });
    
    // Add all menu elements to container (overlay is separate)
    this.gameOverMenu.add([
      gameOverText,
      thankYouText,
      questionText,
      playAgainButton,
      playAgainText,
      homeButton,
      homeText
    ]);
  }
  
  private restartGame() {
    // Hide game menu if open
    if (this.gameMenu) {
      this.gameMenu.hideMenu();
    }
    
    // Clear all game state before restarting
    this.isGameOver = false;
    this.isPaused = false;
    this.currentWave = 1;
    this.isWaveActive = false;
    this.enemiesRemainingInWave = 0;
    
    // Destroy game over menu if it exists
    if (this.gameOverMenu) {
      this.gameOverMenu.destroy();
      this.gameOverMenu = undefined;
    }
    
    // Stop and restart both scenes
    this.scene.stop("Game");
    this.scene.stop("UI");
    
    // Start both scenes fresh (this will reset all state)
    this.scene.start("Game");
    this.scene.launch("UI");
  }
  
  private goHome() {
    // Stop all scenes and return to MainMenu
    this.scene.stop("Game");
    this.scene.stop("UI");
    this.scene.start("MainMenu");
  }

  private showSellButton(tower: BaseTower) {
    // Hide existing sell button if any
    this.hideSellButton();

    // Calculate sell price (half of cost)
    const sellPrice = Math.floor(tower.getCost() / 2);
    
    // Position button above the tower
    const buttonX = tower.x;
    const buttonY = tower.y - 60; // Above the tower
    
    // Create sell button
    this.sellButton = this.add.rectangle(buttonX, buttonY, 100, 40, 0xaa0000, 1);
    this.sellButton.setStrokeStyle(2, 0xffffff, 1);
    this.sellButton.setInteractive({ useHandCursor: true });
    this.sellButton.setDepth(700); // Above towers
    
    // Add hover effect
    this.sellButton.on("pointerover", () => {
      if (this.sellButton) {
        this.sellButton.setFillStyle(0xcc0000, 1);
      }
    });
    this.sellButton.on("pointerout", () => {
      if (this.sellButton) {
        this.sellButton.setFillStyle(0xaa0000, 1);
      }
    });
    
    // Sell tower on click
    this.sellButton.on("pointerdown", () => {
      this.sellTower(tower);
    });

    // Add sell text
    this.sellButtonText = this.add.text(buttonX, buttonY, `Sell $${sellPrice}`, {
      fontSize: "14px",
      color: "#ffffff",
      fontStyle: "bold"
    });
    this.sellButtonText.setOrigin(0.5, 0.5);
    this.sellButtonText.setDepth(701);
    this.sellButtonText.setInteractive({ useHandCursor: true });
    
    // Make text also clickable
    this.sellButtonText.on("pointerover", () => {
      if (this.sellButton) {
        this.sellButton.setFillStyle(0xcc0000, 1);
      }
    });
    this.sellButtonText.on("pointerout", () => {
      if (this.sellButton) {
        this.sellButton.setFillStyle(0xaa0000, 1);
      }
    });
    this.sellButtonText.on("pointerdown", () => {
      this.sellTower(tower);
    });
  }

  private hideSellButton() {
    if (this.sellButton) {
      this.sellButton.destroy();
      this.sellButton = undefined;
    }
    if (this.sellButtonText) {
      this.sellButtonText.destroy();
      this.sellButtonText = undefined;
    }
  }

  private sellTower(tower: BaseTower) {
    // Calculate sell price (half of cost)
    const sellPrice = Math.floor(tower.getCost() / 2);
    
    // Add money back to player
    const uiScene = this.scene.get("UI") as UIScene;
    uiScene.addMoney(sellPrice);
    
    // Remove tower from group
    this.towers.remove(tower, true, true);
    
    // Hide range if it was showing
    tower.hideRange();
    
    // Deselect tower
    this.selectedTower = null;
    
    // Hide sell button
    this.hideSellButton();
    
    console.log(`Tower sold for $${sellPrice}`);
  }
}
