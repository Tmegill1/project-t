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
import { MAX_WAVES, SPAWN_TIMING, squareSpawnDelay } from "../game/data/waves";
import { sellRefund } from "../game/sim/economy";
import { sceneEvents } from "../game/events";
import Projectile from "../game/sprites/towers/Projectile";
import UIScene from "./UIScene";

// Import new modules
import { MapRenderer } from "../game/systems/MapRenderer";
import { WaveManager } from "../game/managers/WaveManager";
import { EnemySpawner } from "../game/managers/EnemySpawner";
import { TowerManager } from "../game/managers/TowerManager";
import { GameOverMenu } from "../game/ui/GameOverMenu";
import { CongratulationsMenu } from "../game/ui/CongratulationsMenu";
import { TowerPanel } from "../game/ui/TowerPanel";
import type { UpgradeBranch } from "../game/data/upgrades";
import { StartButton } from "../game/ui/StartButton";

export default class GameScene extends Phaser.Scene {
  // UI Elements
  private hoverRect?: Phaser.GameObjects.Rectangle;
  private selectRect?: Phaser.GameObjects.Rectangle;
  private debugText?: Phaser.GameObjects.Text;
  
  // Game Groups
  enemies!: Phaser.GameObjects.Group;
  private enemyPaths: Array<Array<{ x: number; y: number }>> = [];
  private towers!: Phaser.GameObjects.Group;
  /** Read by BaseTower.shoot() to register new projectiles. */
  projectiles!: Phaser.GameObjects.Group;
  
  // Tower Selection (now handled by UIScene)
  private selectedTowerType: TowerType | null = null;
  private isDraggingTower: boolean = false;
  private selectedTower: BaseTower | null = null;
  private towerPlacementPreview?: Phaser.GameObjects.Rectangle;
  
  // Wave Management
  private currentWave: number = 1;
  private isWaveActive: boolean = false;
  private enemiesRemainingInWave: number = 0;
  private maxWaves: number = MAX_WAVES;
  
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
  private towerPanel?: TowerPanel;
  private startButtons: StartButton[] = [];
  
  // Current map tracking
  private currentMap: TileKind[][];
  private currentMapName: "demoMap" | "map2" = "demoMap";

  constructor() {
    super("Game");
    // Initialize with demoMap as default
    this.currentMap = demoMap;
  }
  
  init(data?: { mapName?: "demoMap" | "map2" }) {
    // Check if we should load a specific map
    if (data?.mapName === "map2") {
      this.currentMap = map2Data;
      this.currentMapName = "map2";
    } else {
      this.currentMap = demoMap;
      this.currentMapName = "demoMap";
    }
  }

  create() {
    try {
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
      
      // Towers read this off the scene when they fire. Declared as a public
      // field rather than attached with a cast so the coupling is visible.
      
      // Get enemy paths using current map
      this.enemyPaths = getAllSpawnPaths(this.currentMap);
      if (this.enemyPaths.length === 0) {
        console.error("GameScene: No enemy paths found! Map might be invalid.");
      }
      
      // Initialize managers
      this.waveManager = new WaveManager();
      this.enemySpawner = new EnemySpawner(this, this.enemies, this.enemyPaths, this.currentWave);
      this.towerManager = new TowerManager(this, this.towers, this.currentMap, this.currentMapName);
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
      this.towerPanel = new TowerPanel(this);
      
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
    
    if (this.towerPanel) {
      this.towerPanel.hide();
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
    sceneEvents(this).on("tower-selected", (selected) => {
      const towerType = selected as TowerType | null;
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
    const events = sceneEvents(this);

    events.off("enemy-reached-goal");
    events.off("enemy-killed");
    events.off("game-over");

    // Lives are owned by UIScene, so a leak is forwarded across the scene
    // boundary rather than handled here.
    events.on("enemy-reached-goal", (lifeLoss) => {
      sceneEvents(this.scene.get("UI")).emit("enemy-reached-goal", lifeLoss);
    });

    events.on("enemy-killed", (reward) => {
      const uiScene = this.scene.get("UI") as UIScene;
      uiScene.addMoney(reward);
    });

    events.on("game-over", () => {
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
      
      // The tower panel registers its own pointer handlers on each row, so a
      // tap inside it must not also fall through to board selection.
      if (this.towerPanel?.isVisible() && this.isPointerOverPanel(p)) {
        return;
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
      sceneEvents(this.scene.get("UI")).emit("purchase-tower", towerCost);
      sceneEvents(this).emit("towerPlaced", tower.getKind(), col, row);
      // Update tower costs in UIScene
      const uiScene = this.scene.get("UI") as UIScene;
      if (uiScene.updateTowerCosts) {
        uiScene.updateTowerCosts();
      }
    }
    
    this.cancelTowerPlacement();
  }

  /** Whether a pointer is inside the tower panel's screen-space bounds. */
  private isPointerOverPanel(p: Phaser.Input.Pointer): boolean {
    // The panel is anchored bottom-left with setScrollFactor(0), so it is
    // tested in screen coordinates rather than world ones.
    const camera = this.cameras.main;
    return p.x < 320 && p.y > camera.height - 300;
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
    this.towerPanel?.show(tower, {
      onUpgrade: (branch) => this.upgradeTower(tower, branch),
      onSell: () => this.sellTower(tower),
      canAfford: (cost) => (this.scene.get("UI") as UIScene).canAfford(cost),
    });
    this.isDraggingTower = false;
    this.cancelTowerPlacement();
  }

  private deselectTower() {
    if (this.selectedTower) {
      this.selectedTower.hideRange();
      this.selectedTower = null;
    }
    this.towerPanel?.hide();
  }

  /** Buys a tier, charging the player and refreshing the panel. */
  private upgradeTower(tower: BaseTower, branch: UpgradeBranch) {
    if (!tower.canUpgradeBranch(branch)) return;

    const cost = tower.getUpgradeCost(branch);
    const uiScene = this.scene.get("UI") as UIScene;
    if (!uiScene.canAfford(cost)) return;

    if (!tower.applyUpgrade(branch)) return;

    sceneEvents(this.scene.get("UI")).emit("purchase-tower", cost);
    sceneEvents(this).emit("towerUpgraded", tower.getKind(), branch, tower.getTiers()[branch]);

    // The range indicator and the panel's prices both move with the purchase.
    tower.showRange();
    this.towerPanel?.refresh();
  }

  private sellTower(tower: BaseTower) {
    // Refunds half of everything sunk in, upgrades included — otherwise
    // committing to a branch would be punished at sell time.
    const sellPrice = sellRefund(tower.getInvestedValue());
    
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
    sceneEvents(this).emit("waveStarted", waveNumber);
    
    const uiScene = this.scene.get("UI") as UIScene;
    uiScene.setWave(waveNumber);

    const waveConfig = this.waveManager.getWaveConfig(waveNumber);
    const totalEnemies = waveConfig.total;
    this.enemiesRemainingInWave = totalEnemies * this.enemyPaths.length;
    
    const { healthModifier, speedModifier } = this.waveManager.calculateModifiers(waveNumber);
    this.enemySpawner.setModifiers(healthModifier, speedModifier);
    this.enemySpawner.setCurrentWave(waveNumber);

    const slimeCount = waveConfig.spawns.find(s => s.kind === "slime")?.count || 0;
    const beeCount = waveConfig.spawns.find(s => s.kind === "bee")?.count || 0;
    const ogreCount = waveConfig.spawns.find(s => s.kind === "ogre")?.count || 0;

    // Each group carries only its own properties, so a wave is never uniformly
    // immune to the player's build.
    const propsFor = (kind: "slime" | "bee" | "ogre") =>
      waveConfig.spawns.find(s => s.kind === kind)?.properties ?? [];

    const spawnInterval = SPAWN_TIMING.intervalMs;
    let enemiesSpawned = 0;

    const ogreStartDelay = squareSpawnDelay(slimeCount);
    const beeStartDelay = SPAWN_TIMING.beeStartDelayMs;

    // Spawn slimes
    for (let i = 0; i < slimeCount; i++) {
      const spawnDelay = i * spawnInterval;
      for (let pathIndex = 0; pathIndex < this.enemyPaths.length; pathIndex++) {
        this.time.delayedCall(spawnDelay, () => {
          this.enemySpawner!.spawnEnemy("slime", pathIndex, propsFor("slime"));
          enemiesSpawned++;
          this.enemiesRemainingInWave--;
          this.checkWaveCompletion(enemiesSpawned, totalEnemies);
        });
      }
    }

    // Spawn bees
    for (let i = 0; i < beeCount; i++) {
      const spawnDelay = beeStartDelay + (i * spawnInterval);
      for (let pathIndex = 0; pathIndex < this.enemyPaths.length; pathIndex++) {
        this.time.delayedCall(spawnDelay, () => {
          this.enemySpawner!.spawnEnemy("bee", pathIndex, propsFor("bee"));
          enemiesSpawned++;
          this.enemiesRemainingInWave--;
          this.checkWaveCompletion(enemiesSpawned, totalEnemies);
        });
      }
    }

    // Spawn ogres
    for (let i = 0; i < ogreCount; i++) {
      const spawnDelay = ogreStartDelay + (i * spawnInterval);
      for (let pathIndex = 0; pathIndex < this.enemyPaths.length; pathIndex++) {
        this.time.delayedCall(spawnDelay, () => {
          this.enemySpawner!.spawnEnemy("ogre", pathIndex, propsFor("ogre"));
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
    sceneEvents(this).emit("waveCleared", this.currentWave);
    
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
    sceneEvents(this).emit("runEnded", "defeat", this.currentWave);
    this.time.removeAllEvents();
    this.gameOverMenu.show();
  }

  private showCongratulationsMenu() {
    if (this.isGameOver || !this.congratulationsMenu) {
      return;
    }
    
    this.isGameOver = true;
    this.isPaused = true;
    sceneEvents(this).emit("runEnded", "victory", this.currentWave);
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
      this.startWave(this.currentWave);
    });
  }
}
