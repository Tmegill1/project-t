import Phaser from "phaser";
import type GameScene from "./GameScene";
import { canAfford as balanceCovers, purchase } from "../game/sim/economy";
import { sceneEvents } from "../game/events";
import { TowerSelection } from "../ui/towerSelection/TowerSelection";
import type { TowerType } from "../ui/towerSelection/TowerSelection";
import { TILE_SIZE } from "../game/data/tiles";
import { FIRST_MAP, getMap } from "../game/data/maps";
import type { MapName } from "../game/data/maps";

export default class UIScene extends Phaser.Scene {
  private money = 100;
  private lives = 20;
  private wave = 1;
  /** Earned only from lieutenants and bosses. See sim/currencies.ts. */
  private insignia = 0;
  private mapName?: MapName;

  private hudText?: Phaser.GameObjects.Text;
  private towerSelection?: TowerSelection;

  constructor() {
    super("UI");
  }

  init(data?: { mapName?: MapName }) {
    this.mapName = data?.mapName;
  }

  create() {
    // Remove only our specific event listeners to prevent duplicates on restart
    const events = sceneEvents(this);
    events.off("enemyReachedGoal");
    events.off("purchaseTower");
    
    // Reset game state
    // Set money based on map - map2 starts with 250, demoMap starts with 100
    this.money = getMap(this.mapName ?? FIRST_MAP).startingGold;
    this.lives = 20;
    this.wave = 1;
    this.insignia = 0;
    
    // UI should not move with camera
    // Use same font and coloring as debug text (selected tile)
    this.hudText = this.add
      .text(10, 10, "", { 
        fontSize: "16px", 
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 3
      })
      .setScrollFactor(0);

    this.updateHud();

    // Listen for enemy reaching goal
    events.on("enemyReachedGoal", (lifeLoss: number) => {
      this.lives -= lifeLoss;
      this.updateHud();
      
      // Check if game over
      if (this.lives <= 0) {
        this.lives = 0; // Ensure it doesn't go negative
        this.updateHud();
        // Notify GameScene that game is over
        sceneEvents(this.scene.get("Game")).emit("gameOver");
      }
    });

    // Listen for tower purchase confirmation
    events.on("purchaseTower", (cost: number) => {
      const result = purchase(this.money, cost);
      this.money = result.balance;
      this.updateHud();
      events.emit("goldChanged", this.money, -cost);
    });

    // Insignia arrives only from lieutenants and bosses. Routed through the
    // typed bus rather than a direct call, so the currency has one entry point.
    events.on("insigniaChanged", (_total: number, delta: number) => {
      if (delta > 0) {
        this.insignia += delta;
        this.updateHud();
      }
    });

    // For now: quick test hotkeys
    this.input.keyboard?.on("keydown-M", () => {
      this.money += 10;
      this.updateHud();
    });
    this.input.keyboard?.on("keydown-L", () => {
      this.lives -= 1;
      this.updateHud();
    });
    this.input.keyboard?.on("keydown-W", () => {
      this.wave += 1;
      this.updateHud();
    });

    // Setup tower selection dropdown
    this.setupTowerSelection();
  }

  private setupTowerSelection() {
    try {
      // Create TowerSelection with callbacks that request data from GameScene
      // We'll use a delayed initialization approach - wait for GameScene to be ready
      this.time.delayedCall(100, () => {
        const gameScene = this.scene.get("Game") as GameScene;
        if (!gameScene) {
          console.error("GameScene not found for TowerSelection setup");
          return;
        }

        // Both are public fields on GameScene; this used to reach through
        // `as any` into private state.
        const { towerManager, mapRenderer } = gameScene;
        if (!towerManager) {
          console.error("towerManager not found in GameScene");
          return;
        }

        // Get current map dimensions from GameScene
        // Since the dropdown uses setScrollFactor(0), it's positioned in screen space
        // We can get the map dimensions from GameScene's mapRenderer
        const currentMap = mapRenderer?.map;
        let gridCols = 23; // Default fallback
        let tileSize = TILE_SIZE;
        
        if (currentMap && currentMap.length > 0) {
          // Get dimensions from the actual map array
          gridCols = currentMap[0].length;
        }

        // Create TowerSelection - it will use screen-relative positioning internally
        // The gridCols is only used for reference, actual positioning uses screen coordinates
        this.towerSelection = new TowerSelection(
          this,
          gridCols,
          tileSize,
          (towerType: TowerType | null) => {
            // Emit tower selection event to GameScene
            sceneEvents(gameScene).emit("towerSelected", towerType);
          },
          (towerType: TowerType) => {
            return towerManager.getTowerCost(towerType);
          },
          (towerType: TowerType) => {
            return towerManager.getTowerLimit(towerType);
          },
          (towerType: TowerType) => {
            return towerManager.getTowerCount(towerType);
          },
          (towerType: TowerType) => {
            return towerManager.isTowerAtLimit(towerType);
          }
        );
      });
    } catch (error) {
      console.error("Error creating tower selection:", error);
    }
  }

  // Handle clicks for tower selection dropdown
  handleClick(x: number, y: number): boolean {
    if (this.towerSelection && this.towerSelection.handleClick(x, y)) {
      return true;
    }
    return false;
  }

  // Update tower costs when they change
  updateTowerCosts() {
    if (this.towerSelection) {
      this.towerSelection.updateCosts();
    }
  }

  // Close dropdown if open - returns true if dropdown was open
  closeTowerDropdown(): boolean {
    if (this.towerSelection?.getIsDropdownOpen()) {
      this.towerSelection.closeDropdown();
      return true;
    }
    return false;
  }

  // Clear tower selection
  clearTowerSelection() {
    if (this.towerSelection) {
      this.towerSelection.clearSelection();
    }
  }

  updateHud() {
    // The tower budget is shown alongside gold. A limit the player cannot see
    // is not a difficulty lever, it is a wall they walk into.
    const gameScene = this.scene.get("Game") as Phaser.Scene & {
      towerManager?: { getTotalPlaced(): number; getTowerBudget(): number };
    };
    const manager = gameScene?.towerManager;
    const budget = manager ? `   Towers: ${manager.getTotalPlaced()}/${manager.getTowerBudget()}` : "";

    this.hudText?.setText(
      `Money: ${this.money}   Lives: ${this.lives}   Wave: ${this.wave}   ◈ ${this.insignia}${budget}`,
    );
  }

  getInsignia(): number {
    return this.insignia;
  }

  /** Spends Insignia on a power or command upgrade. */
  spendInsignia(amount: number): boolean {
    if (amount < 0 || this.insignia < amount) return false;
    this.insignia -= amount;
    this.updateHud();
    return true;
  }

  /** Adds Insignia. Callers must have earned it from a lieutenant or boss. */
  addInsignia(amount: number) {
    if (amount <= 0) return;
    this.insignia += amount;
    this.updateHud();
  }

  setWave(wave: number) {
    this.wave = wave;
    this.updateHud();
  }

  // Public method to get current money (for external checks)
  getMoney(): number {
    return this.money;
  }

  // Public method to check if can afford
  canAfford(cost: number): boolean {
    return balanceCovers(this.money, cost);
  }

  // Public method to add money (for selling towers, etc.)
  addMoney(amount: number) {
    this.money += amount;
    this.updateHud();
    sceneEvents(this).emit("goldChanged", this.money, amount);
  }

  // Public method to get current lives (for external checks)
  getLives(): number {
    return this.lives;
  }
}
