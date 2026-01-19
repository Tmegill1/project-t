// This is a refactored version - will replace GameScene.ts
// Keeping the original file intact until we verify everything works

import Phaser from "phaser";
import { TILE_SIZE, map2 as demoMap, type TileKind } from "../game/data/map2.ts";
import { tileToWorldCenter, worldToTile } from "../game/map/Grid";
import { getAllSpawnPaths } from "../game/map/PathFinder";
import { BaseEnemy } from "../game/sprites/enemies/BaseEnemy";
import type { TowerType } from "../ui/towerSelection/TowerSelection";
import { TowerSelection } from "../ui/towerSelection/TowerSelection";
import { GameMenu } from "../ui/gameMenu/GameMenu";
import { BaseTower } from "../game/sprites/towers/BaseTower";
import { BasicTower, FastTower } from "../game/sprites/towers/Towers";
import Projectile from "../game/sprites/towers/Projectile";
import UIScene from "./UIScene";

// Import new modules
import { MapRenderer } from "../game/systems/MapRenderer";
import { WaveManager } from "../game/managers/WaveManager";
import { EnemySpawner } from "../game/managers/EnemySpawner";
import { TowerManager } from "../game/managers/TowerManager";
import { GameOverMenu } from "../game/ui/GameOverMenu";
import { SellButton } from "../game/ui/SellButton";

export default class GameScene extends Phaser.Scene {
  // UI Elements
  private hoverRect?: Phaser.GameObjects.Rectangle;
  private selectRect?: Phaser.GameObjects.Rectangle;
  private debugText?: Phaser.GameObjects.Text;
  
  // Game Groups
  private enemies!: Phaser.GameObjects.Group;
  private enemyPaths: Array<Array<{ x: number; y: number }>> = [];
  private towers!: Phaser.GameObjects.Group;
  private projectiles!: Phaser.GameObjects.Group;
  
  // Tower Selection
  private towerSelection?: TowerSelection;
  private selectedTowerType: TowerType | null = null;
  private isDraggingTower: boolean = false;
  private selectedTower: BaseTower | null = null;
  private towerPlacementPreview?: Phaser.GameObjects.Rectangle;
  
  // Wave Management
  private currentWave: number = 1;
  private isWaveActive: boolean = false;
  private enemiesRemainingInWave: number = 0;
  
  // Game State
  private isGameOver: boolean = false;
  private gameMenu?: GameMenu;
  private isPaused: boolean = false;
  
  // Managers and Systems
  private mapRenderer?: MapRenderer;
  private waveManager?: WaveManager;
  private enemySpawner?: EnemySpawner;
  private towerManager?: TowerManager;
  private gameOverMenu?: GameOverMenu;
  private sellButton?: SellButton;

  constructor() {
    super("Game");
  }

  create() {
    try {
      console.log("GameScene: Starting create()");
      
      // Reset game state
      this.resetGameState();
      
      // Ensure input is enabled
      this.input.enabled = true;
      this.input.setPollAlways();
      
      // World setup
      this.cameras.main.setBackgroundColor("#111111");

      // Initialize managers
      this.mapRenderer = new MapRenderer(this, demoMap);
      this.mapRenderer.render();
      
      // Initialize game groups
      this.enemies = this.add.group();
      this.towers = this.add.group();
      this.projectiles = this.add.group();
      
      // Expose projectiles to towers (towers access via sceneRef.projectiles)
      (this as any).projectiles = this.projectiles;
      
      // Get enemy paths
      this.enemyPaths = getAllSpawnPaths();
      console.log(`GameScene: Found ${this.enemyPaths.length} spawn paths`);
      
      // Initialize managers
      this.waveManager = new WaveManager();
      this.enemySpawner = new EnemySpawner(this, this.enemies, this.enemyPaths, this.currentWave);
      this.towerManager = new TowerManager(this, this.towers, demoMap);
      this.gameOverMenu = new GameOverMenu(
        this,
        () => this.restartGame(),
        () => this.goHome()
      );
      this.sellButton = new SellButton(this);
      
      // Create tower selection
      this.setupTowerSelection();
      
      // Create game menu
      this.setupGameMenu();
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Setup input handlers
      this.setupInputHandlers();
      
      // Setup UI elements
      this.setupUI();
      
      // Start first wave after 2 seconds
      this.time.delayedCall(2000, () => {
        this.startWave(this.currentWave);
      });
      
      console.log("GameScene: create() completed successfully");
    } catch (error) {
      console.error("GameScene: Error in create():", error);
      throw error;
    }
  }

  private resetGameState() {
    this.isGameOver = false;
    this.currentWave = 1;
    this.isWaveActive = false;
    this.enemiesRemainingInWave = 0;
    this.selectedTowerType = null;
    this.isDraggingTower = false;
    this.selectedTower = null;
    
    if (this.sellButton) {
      this.sellButton.hide();
    }
    
    if (this.gameOverMenu) {
      this.gameOverMenu.hide();
    }
  }

  private setupTowerSelection() {
    try {
      this.towerSelection = new TowerSelection(
        this,
        (towerType: TowerType | null) => {
          this.selectedTowerType = towerType;
          this.isDraggingTower = towerType !== null;
          if (towerType) {
            if (this.debugText) {
              this.debugText.setText("Tower selected! Click a buildable tile to place.");
            }
          } else {
            this.isDraggingTower = false;
            if (this.debugText) {
              this.debugText.setText("Click a tile");
            }
          }
        },
        (towerType: TowerType) => this.towerManager!.getTowerCost(towerType),
        (towerType: TowerType) => this.towerManager!.getTowerLimit(towerType),
        (towerType: TowerType) => this.towerManager!.getTowerCount(towerType),
        (towerType: TowerType) => this.towerManager!.isTowerAtLimit(towerType)
      );
    } catch (error) {
      console.error("Error creating tower selection:", error);
    }
  }

  private setupGameMenu() {
    try {
      this.gameMenu = new GameMenu(
        this,
        () => { this.isPaused = false; },
        () => { this.restartGame(); },
        () => { this.goHome(); },
        (isPaused: boolean) => { this.isPaused = isPaused; }
      );
      this.setupEscapeKeyHandler();
    } catch (error) {
      console.error("Error creating game menu:", error);
    }
  }

  private setupEventListeners() {
    this.events.off("enemy-reached-goal");
    this.events.off("enemy-killed");
    this.events.off("game-over");
    
    this.events.on("enemy-reached-goal", (lifeLoss: number) => {
      this.scene.get("UI").events.emit("enemy-reached-goal", lifeLoss);
    });
    
    this.events.on("enemy-killed", (reward: number) => {
      const uiScene = this.scene.get("UI") as UIScene;
      uiScene.addMoney(reward);
    });
    
    this.events.on("game-over", () => {
      this.showGameOverMenu();
    });
  }

  private setupUI() {
    // Hover + selection indicators
    this.hoverRect = this.add
      .rectangle(0, 0, TILE_SIZE, TILE_SIZE)
      .setStrokeStyle(2, 0xffff00, 0.9)
      .setVisible(false);

    this.selectRect = this.add
      .rectangle(0, 0, TILE_SIZE, TILE_SIZE)
      .setStrokeStyle(3, 0x00ffcc, 0.95)
      .setVisible(false);

    // Debug text
    const gameWidth = this.scale.width;
    this.debugText = this.add
      .text(gameWidth / 2, 25, "Click a tile", { 
        fontSize: "16px", 
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 3
      })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(10000);
  }

  private setupInputHandlers() {
    // Pointer move for hover
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      const { col, row, inBounds } = worldToTile(p.worldX, p.worldY);
      if (!inBounds || !this.hoverRect) {
        this.hoverRect?.setVisible(false);
        return;
      }
      const c = tileToWorldCenter(col, row);
      this.hoverRect.setPosition(c.x, c.y).setVisible(true);
    });

    // Pointer down for clicks
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.isPaused || this.isGameOver) {
        return;
      }
      
      // Check tower selection dropdown
      if (this.towerSelection && this.towerSelection.handleClick(p.worldX, p.worldY)) {
        return;
      }
      
      // Handle tower placement
      if (this.isDraggingTower) {
        this.handleTowerPlacement(p);
        return;
      }
      
      // Check sell button
      if (this.sellButton?.isVisible()) {
        // Sell button handles its own clicks
        return;
      }
      
      // Handle tower selection
      this.handleTowerSelection(p);
    });
  }

  private handleTowerPlacement(p: Phaser.Input.Pointer) {
    // Don't place if clicking on existing tower
    for (const child of this.towers.children.entries) {
      if (child instanceof BaseTower) {
        const bounds = (child as any).getBounds ? (child as any).getBounds() : null;
        if (bounds && Phaser.Geom.Rectangle.Contains(bounds, p.worldX, p.worldY)) {
          this.isDraggingTower = false;
          return;
        }
      }
    }
    
    const { col, row, inBounds } = worldToTile(p.worldX, p.worldY);
    if (!inBounds || !this.selectedTowerType || !this.towerManager) {
      this.cancelTowerPlacement();
      return;
    }
    
    if (!this.towerManager.canPlaceTower(col, row)) {
      this.cancelTowerPlacement();
      return;
    }
    
    const towerType = this.selectedTowerType;
    
    // Check limit
    if (this.towerManager.isTowerAtLimit(towerType)) {
      const limit = this.towerManager.getTowerLimit(towerType);
      const towerName = towerType === BasicTower ? "Basic" : towerType === FastTower ? "Fast" : "Long";
      if (this.debugText) {
        this.debugText.setText(`${towerName} tower limit reached (${limit})`);
      }
      this.cancelTowerPlacement();
      return;
    }
    
    // Check cost
    const towerCost = this.towerManager.getTowerCost(towerType);
    const uiScene = this.scene.get("UI") as UIScene;
    if (!uiScene.canAfford(towerCost)) {
      if (this.debugText) {
        this.debugText.setText(`Not enough money! Need ${towerCost}, have ${uiScene.getMoney()}`);
      }
      this.cancelTowerPlacement();
      return;
    }
    
    // Remove frame 6/7 sprites if they exist
    if (this.mapRenderer) {
      this.mapRenderer.removeFrame6Sprite(row, col);
      this.mapRenderer.removeFrame7Sprite(row, col);
    }
    
    // Place tower
    const tower = this.towerManager.placeTower(towerType, col, row);
    if (tower) {
      this.scene.get("UI").events.emit("purchase-tower", towerCost);
      if (this.towerSelection) {
        this.towerSelection.updateCosts();
      }
    }
    
    this.cancelTowerPlacement();
  }

  private cancelTowerPlacement() {
    this.isDraggingTower = false;
    if (this.towerPlacementPreview) {
      this.towerPlacementPreview.destroy();
      this.towerPlacementPreview = undefined;
    }
    if (this.debugText) {
      this.debugText.setText("Click a tile");
    }
  }

  private handleTowerSelection(p: Phaser.Input.Pointer) {
    const { col, row, inBounds } = worldToTile(p.worldX, p.worldY);
    
    // Try to select by tile location first
    if (inBounds && this.towerManager) {
      const towerAtTile = this.towerManager.getTowerAt(col, row);
      if (towerAtTile) {
        this.selectTower(towerAtTile);
        return;
      }
    }
    
    // Fallback: check by bounds
    for (const child of this.towers.children.entries) {
      if (child instanceof BaseTower) {
        const bounds = (child as any).getBounds ? (child as any).getBounds() : null;
        if (bounds && Phaser.Geom.Rectangle.Contains(bounds, p.worldX, p.worldY)) {
          this.selectTower(child);
          return;
        }
      }
    }
    
    // Deselect if clicking elsewhere
    this.deselectTower();
    
    // Update debug text
    if (inBounds) {
      const kind = demoMap[row][col] as TileKind;
      if (this.debugText) {
        this.debugText.setText(`Selected: (${col}, ${row}) kind=${kind}`);
      }
      if (this.selectRect) {
        const c = tileToWorldCenter(col, row);
        this.selectRect.setPosition(c.x, c.y).setVisible(true);
      }
    }
  }

  private selectTower(tower: BaseTower) {
    if (this.selectedTower) {
      this.selectedTower.hideRange();
    }
    this.selectedTower = tower;
    tower.showRange();
    if (this.sellButton) {
      this.sellButton.show(tower, () => this.sellTower(tower));
    }
    this.isDraggingTower = false;
    this.cancelTowerPlacement();
  }

  private deselectTower() {
    if (this.selectedTower) {
      this.selectedTower.hideRange();
      this.selectedTower = null;
    }
    if (this.sellButton) {
      this.sellButton.hide();
    }
  }

  private sellTower(tower: BaseTower) {
    const sellPrice = Math.floor(tower.getCost() / 2);
    
    if (this.towerManager) {
      this.towerManager.removeTower(tower);
    }
    
    if (this.towerSelection) {
      this.towerSelection.updateCosts();
    }
    
    const uiScene = this.scene.get("UI") as UIScene;
    uiScene.addMoney(sellPrice);
    
    this.deselectTower();
  }

  private startWave(waveNumber: number) {
    if (this.isWaveActive || !this.waveManager || !this.enemySpawner) {
      return;
    }

    this.currentWave = waveNumber;
    this.isWaveActive = true;
    
    const uiScene = this.scene.get("UI") as UIScene;
    uiScene.setWave(waveNumber);

    const waveConfig = this.waveManager.getWaveConfig(waveNumber);
    const totalEnemies = waveConfig.total;
    this.enemiesRemainingInWave = totalEnemies * this.enemyPaths.length;
    
    const { healthModifier, speedModifier } = this.waveManager.calculateModifiers(waveNumber);
    this.enemySpawner.setModifiers(healthModifier, speedModifier);
    this.enemySpawner.setCurrentWave(waveNumber);

    const circleCount = waveConfig.spawns.find(s => s.type === "circle")?.count || 0;
    const triangleCount = waveConfig.spawns.find(s => s.type === "triangle")?.count || 0;
    const squareCount = waveConfig.spawns.find(s => s.type === "square")?.count || 0;

    const spawnInterval = 500;
    let enemiesSpawned = 0;

    const lastCircleSpawnTime = (circleCount - 1) * spawnInterval;
    const squareStartAfterLastCircle = lastCircleSpawnTime + 3000;
    const squareStartAfterFirstCircle = 10000;
    const squareStartDelay = Math.min(squareStartAfterLastCircle, squareStartAfterFirstCircle);
    const triangleStartDelay = 5000;

    // Spawn circles
    for (let i = 0; i < circleCount; i++) {
      const spawnDelay = i * spawnInterval;
      for (let pathIndex = 0; pathIndex < this.enemyPaths.length; pathIndex++) {
        this.time.delayedCall(spawnDelay, () => {
          this.enemySpawner!.spawnEnemy("circle", pathIndex);
          enemiesSpawned++;
          this.enemiesRemainingInWave--;
          this.checkWaveCompletion(enemiesSpawned, totalEnemies);
        });
      }
    }

    // Spawn triangles
    for (let i = 0; i < triangleCount; i++) {
      const spawnDelay = triangleStartDelay + (i * spawnInterval);
      for (let pathIndex = 0; pathIndex < this.enemyPaths.length; pathIndex++) {
        this.time.delayedCall(spawnDelay, () => {
          this.enemySpawner!.spawnEnemy("triangle", pathIndex);
          enemiesSpawned++;
          this.enemiesRemainingInWave--;
          this.checkWaveCompletion(enemiesSpawned, totalEnemies);
        });
      }
    }

    // Spawn squares
    for (let i = 0; i < squareCount; i++) {
      const spawnDelay = squareStartDelay + (i * spawnInterval);
      for (let pathIndex = 0; pathIndex < this.enemyPaths.length; pathIndex++) {
        this.time.delayedCall(spawnDelay, () => {
          this.enemySpawner!.spawnEnemy("square", pathIndex);
          enemiesSpawned++;
          this.enemiesRemainingInWave--;
          this.checkWaveCompletion(enemiesSpawned, totalEnemies);
        });
      }
    }
  }

  private checkWaveCompletion(enemiesSpawned: number, totalEnemies: number) {
    if (enemiesSpawned >= totalEnemies * this.enemyPaths.length) {
      this.time.delayedCall(1000, () => {
        this.startWaveCompletionCheck();
      });
    }
  }

  private startWaveCompletionCheck() {
    const checkInterval = this.time.addEvent({
      delay: 500,
      callback: () => {
        if (this.isWaveActive && this.enemiesRemainingInWave <= 0 && this.enemies.children.size === 0) {
          checkInterval.destroy();
          this.onWaveComplete();
        }
      },
      loop: true
    });
  }

  private onWaveComplete() {
    this.isWaveActive = false;
    console.log(`Wave ${this.currentWave} complete!`);
    this.time.delayedCall(3000, () => {
      this.startWave(this.currentWave + 1);
    });
  }

  update(time: number, delta: number) {
    if (this.isGameOver || this.isPaused) {
      return;
    }
    
    // Update enemies
    this.enemies.children.entries.forEach((child) => {
      if (child instanceof BaseEnemy) {
        child.update(time, delta);
      }
    });
    
    // Check wave completion
    if (this.isWaveActive && this.enemiesRemainingInWave <= 0 && this.enemies.children.size === 0) {
      this.onWaveComplete();
    }
    
    // Update towers
    this.towers.children.entries.forEach((child) => {
      if (child instanceof BaseTower) {
        child.update(time, delta, this.enemies);
      }
    });
    
    // Update projectiles
    this.projectiles.children.entries.forEach((child) => {
      if (child instanceof Projectile) {
        child.update(time, delta);
      }
    });
  }

  private showGameOverMenu() {
    if (this.isGameOver || !this.gameOverMenu) {
      return;
    }
    
    this.isGameOver = true;
    this.time.removeAllEvents();
    this.gameOverMenu.show();
  }

  private restartGame() {
    if (this.gameMenu) {
      this.gameMenu.hideMenu();
    }
    
    this.scene.stop("Game");
    this.scene.stop("UI");
    this.scene.start("Game");
    this.scene.launch("UI");
  }

  private goHome() {
    this.scene.stop("Game");
    this.scene.stop("UI");
    this.scene.start("MainMenu");
  }

  private setupEscapeKeyHandler() {
    this.input.keyboard?.on("keydown-ESC", () => {
      if (this.towerSelection?.getIsDropdownOpen()) {
        this.towerSelection.closeDropdown();
        return;
      }
      
      if (this.isDraggingTower && this.selectedTowerType) {
        this.selectedTowerType = null;
        this.isDraggingTower = false;
        if (this.towerSelection) {
          this.towerSelection.clearSelection();
        }
        this.cancelTowerPlacement();
        return;
      }
      
      if (this.gameMenu?.isMenuVisible()) {
        this.gameMenu.hideMenu();
        return;
      }
      
      if (!this.isGameOver && this.gameMenu) {
        this.gameMenu.showMenu();
      }
    });
  }
}
