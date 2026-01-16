import Phaser from "phaser";

export default class UIScene extends Phaser.Scene {
  private money = 100;
  private lives = 20;
  private wave = 1;

  private hudText?: Phaser.GameObjects.Text;

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
    this.hudText = this.add
      .text(10, 10, "", { fontSize: "16px", color: "#ffffff" })
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
}
