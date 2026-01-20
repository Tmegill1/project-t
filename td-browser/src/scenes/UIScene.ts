import Phaser from "phaser";
import { TowerSelection } from "../ui/towerSelection/TowerSelection";
import type { TowerType } from "../ui/towerSelection/TowerSelection";
import { TILE_SIZE } from "../game/data/map2";

export default class UIScene extends Phaser.Scene {
  private money = 100;
  private lives = 20;
  private wave = 1;

  private hudText?: Phaser.GameObjects.Text;
  private towerSelection?: TowerSelection;

  constructor() {
    super("UI");
  }

  create() {
    // Remove only our specific event listeners to prevent duplicates on restart
    this.events.off("enemy-reached-goal");
    this.events.off("check-tower-cost");
    this.events.off("purchase-tower");
    
    // Reset game state
    this.money = 100;
    this.lives = 20;
    this.wave = 1;
    
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
    this.events.on("enemy-reached-goal", (lifeLoss: number) => {
      this.lives -= lifeLoss;
      this.updateHud();
      
      // Check if game over
      if (this.lives <= 0) {
        this.lives = 0; // Ensure it doesn't go negative
        this.updateHud();
        // Notify GameScene that game is over
        this.scene.get("Game").events.emit("game-over");
      }
    });

    // Listen for tower purchase requests
    this.events.on("check-tower-cost", (cost: number, callback: (canAfford: boolean) => void) => {
      const canAfford = this.money > 0 && this.money >= cost;
      callback(canAfford);
    });

    // Listen for tower purchase confirmation
    this.events.on("purchase-tower", (cost: number) => {
      this.money -= cost;
      this.updateHud();
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
        const gameScene = this.scene.get("Game");
        if (!gameScene) {
          console.error("GameScene not found for TowerSelection setup");
          return;
        }

        // Access towerManager directly from GameScene (using type assertion to access private property)
        const towerManager = (gameScene as any).towerManager;
        if (!towerManager) {
          console.error("towerManager not found in GameScene");
          return;
        }

        // Get current map dimensions from GameScene
        // Since the dropdown uses setScrollFactor(0), it's positioned in screen space
        // We can get the map dimensions from GameScene's mapRenderer
        const currentMap = (gameScene as any).mapRenderer?.map;
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
            gameScene.events.emit("tower-selected", towerType);
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
    this.hudText?.setText(`Money: ${this.money}   Lives: ${this.lives}   Wave: ${this.wave}`);
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
    return this.money > 0 && this.money >= cost;
  }

  // Public method to add money (for selling towers, etc.)
  addMoney(amount: number) {
    this.money += amount;
    this.updateHud();
  }

  // Public method to get current lives (for external checks)
  getLives(): number {
    return this.lives;
  }
}
