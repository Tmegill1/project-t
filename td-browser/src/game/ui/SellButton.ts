import Phaser from "phaser";
import { BaseTower } from "../sprites/towers/BaseTower";

export class SellButton {
  private scene: Phaser.Scene;
  private button?: Phaser.GameObjects.Rectangle;
  private text?: Phaser.GameObjects.Text;
  private onSell?: () => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  show(tower: BaseTower, onSell: () => void) {
    this.hide();
    this.onSell = onSell;

    const sellPrice = Math.floor(tower.getCost() / 2);
    const buttonX = tower.x;
    const buttonY = tower.y - 60;

    // Create sell button
    this.button = this.scene.add.rectangle(buttonX, buttonY, 100, 40, 0xaa0000, 1);
    this.button.setStrokeStyle(2, 0xffffff, 1);
    this.button.setInteractive({ useHandCursor: true });
    this.button.setDepth(700);

    // Add hover effect
    this.button.on("pointerover", () => {
      if (this.button) {
        this.button.setFillStyle(0xcc0000, 1);
      }
    });
    this.button.on("pointerout", () => {
      if (this.button) {
        this.button.setFillStyle(0xaa0000, 1);
      }
    });
    this.button.on("pointerdown", () => {
      if (this.onSell) {
        this.onSell();
      }
    });

    // Add sell text
    this.text = this.scene.add.text(buttonX, buttonY, `Sell $${sellPrice}`, {
      fontSize: "14px",
      color: "#ffffff",
      fontStyle: "bold"
    });
    this.text.setOrigin(0.5, 0.5);
    this.text.setDepth(701);
    this.text.setInteractive({ useHandCursor: true });

    // Make text also clickable
    this.text.on("pointerover", () => {
      if (this.button) {
        this.button.setFillStyle(0xcc0000, 1);
      }
    });
    this.text.on("pointerout", () => {
      if (this.button) {
        this.button.setFillStyle(0xaa0000, 1);
      }
    });
    this.text.on("pointerdown", () => {
      if (this.onSell) {
        this.onSell();
      }
    });
  }

  hide() {
    if (this.button) {
      this.button.destroy();
      this.button = undefined;
    }
    if (this.text) {
      this.text.destroy();
      this.text = undefined;
    }
    this.onSell = undefined;
  }

  isVisible(): boolean {
    return this.button !== undefined;
  }
}
