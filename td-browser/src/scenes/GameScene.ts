import Phaser from "phaser";
import { GRID_COLS, GRID_ROWS, TILE_SIZE, demoMap, type TileKind } from "../game/data/demoMap.ts";
import { tileToWorldCenter } from "../game/map/Grid";
import { getPathFromSpawnToGoal } from "../game/map/PathFinder";
import { CircleEnemy, SquareEnemy, TriangleEnemy } from "../game/sprites/enemies/Enemy";
import { BaseEnemy } from "../game/sprites/enemies/BaseEnemy";
import Tower from "../game/sprites/towers/Tower";
import Projectile from "../game/sprites/towers/Projectile";

export default class GameScene extends Phaser.Scene {
  private hoverRect?: Phaser.GameObjects.Rectangle;
  private selectRect?: Phaser.GameObjects.Rectangle;
  private debugText?: Phaser.GameObjects.Text;
  private enemies!: Phaser.GameObjects.Group;
  private enemyPath!: Array<{ x: number; y: number }>;
  private towers!: Phaser.GameObjects.Group;
  private projectiles!: Phaser.GameObjects.Group;
  private towerIcon?: Phaser.GameObjects.GameObject & { 
    getBounds(): Phaser.Geom.Rectangle | null;
    setScrollFactor(factor: number): void;
    setDepth(depth: number): void;
    setInteractive(options?: any): void;
    setOrigin(x: number, y: number): void;
  };
  private towerIconCol: number = 5;
  private towerIconRow: number = 0;
  private isDraggingTower: boolean = false;
  private selectedTower: Tower | null = null;
  private towerPlacementPreview?: Phaser.GameObjects.Rectangle;

  constructor() {
    super("Game");
  }

  create() {
    try {
      console.log("GameScene: Starting create()");
      
      // Ensure input is enabled
      this.input.enabled = true;
      this.input.setPollAlways();
      
      // World setup
      this.cameras.main.setBackgroundColor("#111111");

      // Draw the map (order matters: tiles first, then grid, then blocked indicators on top)
      this.drawTiles();
      this.drawGrid();
      this.drawBlockedIndicators();

      // Initialize enemy system
      this.enemies = this.add.group();
      console.log("GameScene: Getting path from spawn to goal");
      this.enemyPath = getPathFromSpawnToGoal();
      console.log("GameScene: Path found, length:", this.enemyPath.length);
    
      // Initialize tower and projectile systems
      this.towers = this.add.group();
      this.projectiles = this.add.group();
      
      // Create tower icon at top of screen (with error handling)
      try {
        this.createTowerIcon();
        console.log("GameScene: Tower icon created");
      } catch (error) {
        console.error("Error creating tower icon:", error);
      }
    
    // Listen for enemy reaching goal
    this.events.on("enemy-reached-goal", (lifeLoss: number) => {
      // Notify UI scene with life loss amount
      this.scene.get("UI").events.emit("enemy-reached-goal", lifeLoss);
    });

    // Spawn test enemies (delayed by 2 seconds)
    this.time.delayedCall(3000, () => {
      this.spawnEnemy("circle");
    });
    this.time.delayedCall(4000, () => {
      this.spawnEnemy("square");
    });
    this.time.delayedCall(5000, () => {
      this.spawnEnemy("triangle");
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
      console.log(`Pointer down at world: (${p.worldX}, ${p.worldY}), screen: (${p.x}, ${p.y}), isDraggingTower: ${this.isDraggingTower}`);
      
      // Handle tower placement FIRST (if tower icon was already selected)
      if (this.isDraggingTower) {
        console.log("isDraggingTower is TRUE - processing placement");
        
        // Don't place if clicking on the tower icon again
        let clickedTowerIcon = false;
        if (this.towerIcon) {
          const bounds = this.towerIcon.getBounds();
          if (bounds && Phaser.Geom.Rectangle.Contains(bounds, p.worldX, p.worldY)) {
            console.log("Clicked tower icon again - keeping selection active");
            clickedTowerIcon = true;
          }
        }
        
        // Don't place if clicking on an existing tower
        let clickedExistingTower = false;
        for (const child of this.towers.children.entries) {
          if (child instanceof Tower) {
            const bounds = child.getBounds();
            if (bounds && Phaser.Geom.Rectangle.Contains(bounds, p.worldX, p.worldY)) {
              console.log("Clicked existing tower - canceling placement");
              clickedExistingTower = true;
              this.isDraggingTower = false;
              break;
            }
          }
        }
        
        if (clickedTowerIcon || clickedExistingTower) {
          return;
        }
        
        const { col, row, inBounds } = this.worldToTile(p.worldX, p.worldY);
        console.log(`Attempting to place tower at tile: (${col}, ${row}), inBounds: ${inBounds}, worldX: ${p.worldX}, worldY: ${p.worldY}`);
        if (inBounds) {
          const kind = demoMap[row][col] as TileKind;
          const hasTower = this.hasTowerAt(col, row);
          console.log(`Selected tile: (${col}, ${row}) - kind=${kind}, hasTower: ${hasTower}`);
          if (kind === "buildable" && !hasTower) {
            console.log("✓ Conditions met - creating tower now!");
            try {
              console.log(`Creating Tower at col=${col}, row=${row}`);
              const tower = new Tower(this, col, row);
              console.log("Tower object created:", tower);
              this.towers.add(tower);
              console.log(`✓ Tower added to group. Total towers: ${this.towers.children.size}`);
              console.log(`Tower position: x=${tower.x}, y=${tower.y}, col=${tower.getCol()}, row=${tower.getRow()}`);
            } catch (error) {
              console.error("✗ Error creating tower:", error);
              console.error("Error stack:", (error as Error).stack);
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
      
      // Check if clicking on tower icon (to select it for placement)
      // Primary: Check bounds (visual position) - most reliable
      if (this.towerIcon) {
        const bounds = this.towerIcon.getBounds();
        if (bounds) {
          console.log(`Tower icon bounds: x=${bounds.x}, y=${bounds.y}, width=${bounds.width}, height=${bounds.height}, click at world: (${p.worldX}, ${p.worldY}), screen: (${p.x}, ${p.y})`);
          // Check both world and screen coordinates for better compatibility
          const inBoundsWorld = Phaser.Geom.Rectangle.Contains(bounds, p.worldX, p.worldY);
          const inBoundsScreen = Phaser.Geom.Rectangle.Contains(bounds, p.x, p.y);
          if (inBoundsWorld || inBoundsScreen) {
            this.isDraggingTower = true;
            console.log("✓ Tower selected (via bounds) - Click on a buildable tile to place");
            if (this.debugText) {
              this.debugText.setText("Tower selected! Click a buildable tile to place.");
            }
            return;
          }
        }
      }
      
      // Fallback: Use tile-based detection
      const { col: clickCol, row: clickRow, inBounds: clickInBounds } = this.worldToTile(p.worldX, p.worldY);
      if (clickInBounds && clickCol === this.towerIconCol && clickRow === this.towerIconRow) {
        this.isDraggingTower = true;
        console.log("✓ Tower selected (via tile) - Click on a buildable tile to place");
        if (this.debugText) {
          this.debugText.setText("Tower selected! Click a buildable tile to place.");
        }
        return;
      }
      
      // Check if clicking on a tower (to select and show range)
      for (const child of this.towers.children.entries) {
        if (child instanceof Tower) {
          const bounds = child.getBounds();
          if (bounds && Phaser.Geom.Rectangle.Contains(bounds, p.worldX, p.worldY)) {
            // Select tower and show range
            if (this.selectedTower) {
              this.selectedTower.hideRange();
            }
            this.selectedTower = child;
            child.showRange();
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
      }

      const { col, row, inBounds } = this.worldToTile(p.worldX, p.worldY);
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

  private drawTiles() {
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

    // Slight transparency overlay to let grid lines show
    g.setAlpha(0.7);
  }

  private drawBlockedIndicators() {
    const blockedG = this.add.graphics();
    let blockedCount = 0;

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const kind = demoMap[r][c] as TileKind;
        
        if (kind === "blocked") {
          blockedCount++;
          const x = c * TILE_SIZE;
          const y = r * TILE_SIZE;
          
          // Red outline
          blockedG.lineStyle(4, 0xff0000, 1);
          blockedG.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
          
          // Red X mark
          const padding = 6;
          blockedG.lineBetween(x + padding, y + padding, x + TILE_SIZE - padding, y + TILE_SIZE - padding);
          blockedG.lineBetween(x + TILE_SIZE - padding, y + padding, x + padding, y + TILE_SIZE - padding);
        }
      }
    }
    
    // Ensure blocked graphics are on top and fully opaque
    blockedG.setDepth(1000);
    console.log(`Blocked tiles rendered: ${blockedCount}`);
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

    switch (type) {
      case "circle":
        enemy = new CircleEnemy(this, startPoint.x, startPoint.y, this.enemyPath);
        break;
      case "square":
        enemy = new SquareEnemy(this, startPoint.x, startPoint.y, this.enemyPath);
        break;
      case "triangle":
        enemy = new TriangleEnemy(this, startPoint.x, startPoint.y, this.enemyPath);
        break;
    }

    this.enemies.add(enemy);
  }

  update(time: number, delta: number) {
    // Update all enemies
    this.enemies.children.entries.forEach((child) => {
      if (child instanceof BaseEnemy) {
        child.update(time, delta);
      }
    });
    
    // Update all towers
    this.towers.children.entries.forEach((child) => {
      if (child instanceof Tower) {
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
  
  private createTowerIcon() {
    try {
      // Place icon in the center of the specified tile
      const iconCol = this.towerIconCol;
      const iconRow = this.towerIconRow;
      const worldPos = tileToWorldCenter(iconCol, iconRow);
      const iconSize = TILE_SIZE * 0.7; // Smaller to fit inside tile
      
      // Create hexagon icon
      // Points should be relative to the polygon's position (0,0), not absolute world coordinates
      const points: Phaser.Geom.Point[] = [];
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        points.push(
          new Phaser.Geom.Point(
            (iconSize / 2) * Math.cos(angle),
            (iconSize / 2) * Math.sin(angle)
          )
        );
      }
      
      this.towerIcon = this.add.polygon(worldPos.x, worldPos.y, points, 0x0066ff, 1);
      if (this.towerIcon) {
        this.towerIcon.setDepth(2000);
        // Set origin to center so the icon is centered on the tile
        this.towerIcon.setOrigin(0, 0);
        // Don't set interactive - we'll check bounds manually to avoid blocking other clicks
      }
    } catch (error) {
      console.error("Error in createTowerIcon:", error);
      // Fallback: create a simple rectangle instead
      const worldPos = tileToWorldCenter(0, 0);
      const fallbackIcon = this.add.rectangle(worldPos.x, worldPos.y, TILE_SIZE * 0.7, TILE_SIZE * 0.7, 0x0066ff, 1);
      if (fallbackIcon) {
        fallbackIcon.setDepth(2000);
        fallbackIcon.setInteractive({ useHandCursor: true });
        this.towerIcon = fallbackIcon;
      }
    }
  }
  
  
  private hasTowerAt(col: number, row: number): boolean {
    for (const child of this.towers.children.entries) {
      if (child instanceof Tower) {
        if (child.getCol() === col && child.getRow() === row) {
          return true;
        }
      }
    }
    return false;
  }
}
