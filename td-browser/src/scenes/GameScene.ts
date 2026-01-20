import Phaser from "phaser";
import { TILE_SIZE, GRID_COLS, GRID_ROWS, demoMap, type TileKind } from "../game/data/demoMap.ts";
import { map2 as map2Data } from "../game/data/map2.ts";
import { tileToWorldCenter, worldToTile } from "../game/map/Grid";
import { getAllSpawnPaths } from "../game/map/PathFinder";
import { BaseEnemy } from "../game/sprites/enemies/BaseEnemy";
import type { TowerType } from "../ui/towerSelection/TowerSelection";
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
import { CongratulationsMenu } from "../game/ui/CongratulationsMenu";
import { SellButton } from "../game/ui/SellButton";
import { StartButton } from "../game/ui/StartButton";

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
  
  // Tower Selection (now handled by UIScene)
  private selectedTowerType: TowerType | null = null;
  private isDraggingTower: boolean = false;
  private selectedTower: BaseTower | null = null;
  private towerPlacementPreview?: Phaser.GameObjects.Rectangle;
  
  // Wave Management
  private currentWave: number = 1;
  private isWaveActive: boolean = false;
  private enemiesRemainingInWave: number = 0;
  private maxWaves: number = 10; // Max waves for demoMap
  
  // Game State
  private isGameOver: boolean = false;
  private gameMenu?: GameMenu;
  private isPaused: boolean = false;
  private hasGameStarted: boolean = false; // Track if player has pressed start button
  
  // Managers and Systems
  private mapRenderer?: MapRenderer;
  private waveManager?: WaveManager;
  private enemySpawner?: EnemySpawner;
  private towerManager?: TowerManager;
  private gameOverMenu?: GameOverMenu;
  private congratulationsMenu?: CongratulationsMenu;
  private sellButton?: SellButton;
  private startButtons: StartButton[] = [];
  
  // Current map tracking
  private currentMap: TileKind[][];

  constructor() {
    super("Game");
    // Initialize with demoMap as default
    this.currentMap = demoMap;
  }
  
  init(data?: { mapName?: "demoMap" | "map2" }) {
    // Check if we should load a specific map
    if (data?.mapName === "map2") {
      this.currentMap = map2Data;
    } else {
      this.currentMap = demoMap;
    }
  }

  create() {
    try {
      console.log("GameScene: Starting create(), scene active:", this.scene.isActive(), "scene visible:", this.scene.isVisible());
      
      // Reset game state
      this.resetGameState();
      
      // Ensure input is enabled
      this.input.enabled = true;
      this.input.setPollAlways();
      
      // World setup
      this.cameras.main.setBackgroundColor("#111111");

      // Initialize managers with current map
      this.mapRenderer = new MapRenderer(this, this.currentMap);
      this.mapRenderer.render();
      
      // Initialize game groups
      this.enemies = this.add.group();
      this.towers = this.add.group();
      this.projectiles = this.add.group();
      
      // Expose projectiles to towers (towers access via sceneRef.projectiles)
      (this as any).projectiles = this.projectiles;
      
      // Get enemy paths using current map
      this.enemyPaths = getAllSpawnPaths(this.currentMap);
      console.log(`GameScene: Found ${this.enemyPaths.length} spawn paths`);
      if (this.enemyPaths.length > 0) {
        console.log(`GameScene: First path has ${this.enemyPaths[0].length} points, starting at (${this.enemyPaths[0][0]?.x}, ${this.enemyPaths[0][0]?.y})`);
      } else {
        console.error("GameScene: No enemy paths found! Map might be invalid.");
      }
      
      // Initialize managers
      this.waveManager = new WaveManager();
      this.enemySpawner = new EnemySpawner(this, this.enemies, this.enemyPaths, this.currentWave);
      this.towerManager = new TowerManager(this, this.towers, this.currentMap);
      this.gameOverMenu = new GameOverMenu(
        this,
        () => this.restartGame(),
        () => this.goHome()
      );
      this.congratulationsMenu = new CongratulationsMenu(
        this,
        () => this.goToNextMap(),
        () => this.goHome()
      );
      this.sellButton = new SellButton(this);
      
      // Setup tower selection event listeners (TowerSelection is now in UIScene)
      this.setupTowerSelectionEvents();
      
      // Create game menu
      this.setupGameMenu();
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Setup input handlers
      this.setupInputHandlers();
      
      // Add hotkey to win level (W key)
      this.input.keyboard?.on("keydown-W", () => {
        console.log("Win hotkey pressed - completing level");
        // Set current wave to max and trigger completion
        this.currentWave = this.maxWaves;
        this.isWaveActive = false;
        this.enemiesRemainingInWave = 0;
        // Clear all enemies
        this.enemies.clear(true, true);
        // Trigger wave completion
        this.onWaveComplete();
      });
      
      // Setup UI elements
      this.setupUI();
      
      // Create start buttons at each enemy entrance
      this.createStartButtons();
      
      console.log("GameScene: create() completed successfully");
    } catch (error) {
      console.error("GameScene: Error in create():", error);
      throw error;
    }
  }

  private resetGameState() {
    this.isGameOver = false;
    this.isPaused = false; // Ensure we're not paused when resetting
    this.hasGameStarted = false; // Reset start button state
    this.currentWave = 1;
    this.isWaveActive = false;
    this.enemiesRemainingInWave = 0;
    this.selectedTowerType = null;
    this.isDraggingTower = false;
    this.selectedTower = null;
    
    // Reset debug flags
    (this as any)._firstUpdateLogged = false;
    (this as any)._skipLogged = false;
    (this as any)._updateLogged = false;
    (this as any)._updateCountLogged = false;
    
    if (this.sellButton) {
      this.sellButton.hide();
    }
    
    if (this.gameOverMenu) {
      this.gameOverMenu.hide();
    }
    
    if (this.congratulationsMenu) {
      this.congratulationsMenu.hide();
    }
    
    // Hide all start buttons
    this.hideStartButtons();
  }

  private setupTowerSelectionEvents() {
    // Listen for tower selection from UIScene
    this.events.on("tower-selected", (towerType: TowerType | null) => {
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
    });
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
      
      // Check tower selection dropdown (now in UIScene)
      const uiScene = this.scene.get("UI") as UIScene;
      if (uiScene.handleClick && uiScene.handleClick(p.worldX, p.worldY)) {
        return;
      }
      
      // Handle tower placement
      if (this.isDraggingTower) {
        this.handleTowerPlacement(p);
        return;
      }
      
      // Check if clicking on sell button
      if (this.sellButton?.isVisible() && this.sellButton.button) {
        const buttonBounds = this.sellButton.button.getBounds();
        if (buttonBounds && Phaser.Geom.Rectangle.Contains(buttonBounds, p.worldX, p.worldY)) {
          // Sell button handles its own clicks via its pointerdown listener
          return;
        }
        // Also check if clicking on sell button text
        if (this.sellButton.text) {
          const textBounds = this.sellButton.text.getBounds();
          if (textBounds && Phaser.Geom.Rectangle.Contains(textBounds, p.worldX, p.worldY)) {
            // Sell button text handles its own clicks via its pointerdown listener
            return;
          }
        }
      }
      
      // Handle tower selection (will deselect if clicking on empty space)
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
      // Update tower costs in UIScene
      const uiScene = this.scene.get("UI") as UIScene;
      if (uiScene.updateTowerCosts) {
        uiScene.updateTowerCosts();
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
      const kind = this.currentMap[row][col] as TileKind;
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
    
    // Update tower costs in UIScene
    const uiScene = this.scene.get("UI") as UIScene;
    if (uiScene.updateTowerCosts) {
      uiScene.updateTowerCosts();
    }
    uiScene.addMoney(sellPrice);
    
    this.deselectTower();
  }

  private startWave(waveNumber: number) {
    // Don't start waves until the game has started (start button pressed)
    if (!this.hasGameStarted) {
      return;
    }
    
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
    
    // Check if all waves are complete and player still has lives
    if (this.currentWave >= this.maxWaves) {
      const uiScene = this.scene.get("UI") as UIScene;
      // Check if player has lives remaining (lives > 0)
      if (uiScene.getLives() > 0) {
        // Show congratulations screen
        this.time.delayedCall(2000, () => {
          this.showCongratulationsMenu();
        });
        return;
      }
    }
    
    // Continue to next wave if not at max
    this.time.delayedCall(3000, () => {
      this.startWave(this.currentWave + 1);
    });
  }

  update(time: number, delta: number) {
    // Log first update call to verify it's running
    if (!(this as any)._firstUpdateLogged) {
      console.log(`GameScene.update: FIRST CALL - time: ${time}, delta: ${delta}, isGameOver: ${this.isGameOver}, isPaused: ${this.isPaused}`);
      (this as any)._firstUpdateLogged = true;
    }
    
    if (this.isGameOver || this.isPaused) {
      if (!(this as any)._skipLogged) {
        console.log(`GameScene.update: Skipped - isGameOver: ${this.isGameOver}, isPaused: ${this.isPaused}`);
        (this as any)._skipLogged = true;
      }
      return;
    }
    
    // Update enemies
    const enemyCount = this.enemies.children.size;
    if (enemyCount > 0) {
      if (!(this as any)._updateLogged) {
        console.log(`GameScene.update: Updating ${enemyCount} enemies, delta: ${delta}`);
        (this as any)._updateLogged = true;
      }
      
      let updatedCount = 0;
      this.enemies.children.entries.forEach((child) => {
        if (child instanceof BaseEnemy) {
          updatedCount++;
          child.update(time, delta);
        }
      });
      
      if (!(this as any)._updateCountLogged && updatedCount === 0) {
        console.warn(`GameScene.update: ${enemyCount} enemies in group but none are BaseEnemy instances!`);
        console.warn(`GameScene.update: Enemy types:`, Array.from(this.enemies.children.entries).map(e => e.constructor.name));
        (this as any)._updateCountLogged = true;
      }
    }
    
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

  private showCongratulationsMenu() {
    if (this.isGameOver || !this.congratulationsMenu) {
      return;
    }
    
    this.isGameOver = true;
    this.isPaused = true;
    this.time.removeAllEvents();
    this.congratulationsMenu.show();
  }

  private restartGame() {
    if (this.gameMenu) {
      this.gameMenu.hideMenu();
    }
    
    // Reset game scale to demoMap dimensions and refresh
    const demoMapWidth = GRID_COLS * TILE_SIZE;
    const demoMapHeight = GRID_ROWS * TILE_SIZE;
    this.scale.resize(demoMapWidth, demoMapHeight);
    // Refresh scale to ensure FIT mode recalculates properly
    this.scale.refresh();
    
    this.scene.stop("Game");
    this.scene.stop("UI");
    // Explicitly start with demoMap (first map)
    this.scene.start("Game", { mapName: "demoMap" });
    this.scene.launch("UI", { mapName: "demoMap" });
  }

  private goToNextMap() {
    if (this.congratulationsMenu) {
      this.congratulationsMenu.hide();
    }
    
    // Update game dimensions for map2
    const map2Cols = 26;
    const map2Rows = 17;
    const map2TileSize = 48;
    const newWidth = map2Cols * map2TileSize;
    const newHeight = map2Rows * map2TileSize;
    
    // Update game scale and refresh before switching
    this.scale.resize(newWidth, newHeight);
    // Refresh scale to ensure FIT mode recalculates properly
    this.scale.refresh();
    
    // Switch to map2
    this.scene.stop("Game");
    this.scene.stop("UI");
    
    // Pass map data to load map2
    this.scene.start("Game", { mapName: "map2" });
    this.scene.launch("UI", { mapName: "map2" });
  }

  private goHome() {
    if (this.congratulationsMenu) {
      this.congratulationsMenu.hide();
    }
    if (this.gameOverMenu) {
      this.gameOverMenu.hide();
    }
    
    // Reset game scale to demoMap dimensions and refresh before going home
    const demoMapWidth = GRID_COLS * TILE_SIZE;
    const demoMapHeight = GRID_ROWS * TILE_SIZE;
    this.scale.resize(demoMapWidth, demoMapHeight);
    // Refresh scale to ensure FIT mode recalculates properly
    this.scale.refresh();
    
    this.scene.stop("Game");
    this.scene.stop("UI");
    this.scene.start("MainMenu");
  }

  private setupEscapeKeyHandler() {
    this.input.keyboard?.on("keydown-ESC", () => {
      // Close tower dropdown in UIScene
      const uiScene = this.scene.get("UI") as UIScene;
      if (uiScene.closeTowerDropdown) {
        const wasOpen = uiScene.closeTowerDropdown();
        if (wasOpen) {
          return;
        }
      }
      
      if (this.isDraggingTower && this.selectedTowerType) {
        this.selectedTowerType = null;
        this.isDraggingTower = false;
        // Clear tower selection in UIScene
        const uiScene = this.scene.get("UI") as UIScene;
        if (uiScene.clearTowerSelection) {
          uiScene.clearTowerSelection();
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

  private createStartButtons() {
    // Clear any existing buttons
    this.hideStartButtons();
    
    // Find all spawn points from the enemy paths
    // Each path's first point is the spawn location
    const spawnPositions: Array<{ x: number; y: number }> = [];
    
    for (const path of this.enemyPaths) {
      if (path.length > 0) {
        const spawnPos = path[0];
        // Check if we already have a button at this position (within 10 pixels)
        const exists = spawnPositions.some(
          pos => Math.abs(pos.x - spawnPos.x) < 10 && Math.abs(pos.y - spawnPos.y) < 10
        );
        if (!exists) {
          spawnPositions.push(spawnPos);
        }
      }
    }
    
    // Create a start button at each spawn position
    for (const spawnPos of spawnPositions) {
      const button = new StartButton(
        this,
        spawnPos.x,
        spawnPos.y,
        () => this.onStartButtonPressed()
      );
      button.show();
      this.startButtons.push(button);
    }
    
    console.log(`GameScene: Created ${this.startButtons.length} start buttons at spawn positions`);
  }

  private hideStartButtons() {
    for (const button of this.startButtons) {
      button.hide();
    }
    this.startButtons = [];
  }

  private onStartButtonPressed() {
    // Hide all start buttons
    this.hideStartButtons();
    
    // Mark game as started
    this.hasGameStarted = true;
    
    // Start the first wave after a short delay
    this.time.delayedCall(500, () => {
      console.log("GameScene: Starting first wave after start button pressed");
      this.startWave(this.currentWave);
    });
  }
}
