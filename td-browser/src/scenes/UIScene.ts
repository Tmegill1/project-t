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
    // UI should not move with camera
    this.hudText = this.add
      .text(10, 10, "", { fontSize: "16px", color: "#ffffff" })
      .setScrollFactor(0);

    this.updateHud();

    // Listen for enemy reaching goal
    this.events.on("enemy-reached-goal", (lifeLoss: number) => {
      this.lives -= lifeLoss;
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

  private updateHud() {
    this.hudText?.setText(`Money: ${this.money}   Lives: ${this.lives}   Wave: ${this.wave}`);
  }
}
