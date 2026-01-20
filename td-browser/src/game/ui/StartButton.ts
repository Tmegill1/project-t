import Phaser from "phaser";

export class StartButton {
  private scene: Phaser.Scene;
  private button?: Phaser.GameObjects.Rectangle;
  private text?: Phaser.GameObjects.Text;
  private onStart?: () => void;
  private x: number;
  private y: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    onStart: () => void
  ) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.onStart = onStart;
  }

  show() {
    if (this.button) {
      return; // Already showing
    }

    // Create start button at the specified position (world coordinates)
    this.button = this.scene.add.rectangle(this.x, this.y, 120, 40, 0x00aa00, 1);
    this.button.setStrokeStyle(2, 0xffffff, 1);
    this.button.setInteractive({ useHandCursor: true });
    this.button.setDepth(5000);

    // Add hover effect
    this.button.on("pointerover", () => {
      if (this.button) {
        this.button.setFillStyle(0x00cc00, 1);
      }
    });
    this.button.on("pointerout", () => {
      if (this.button) {
        this.button.setFillStyle(0x00aa00, 1);
      }
    });
    this.button.on("pointerdown", () => {
      if (this.onStart) {
        this.onStart();
      }
    });

    // Add start text
    this.text = this.scene.add.text(this.x, this.y, "Start", {
      fontSize: "18px",
      color: "#ffffff",
      fontStyle: "bold"
    });
    this.text.setOrigin(0.5, 0.5);
    this.text.setDepth(5001);
    this.text.setInteractive({ useHandCursor: true });

    // Make text also clickable
    this.text.on("pointerover", () => {
      if (this.button) {
        this.button.setFillStyle(0x00cc00, 1);
      }
    });
    this.text.on("pointerout", () => {
      if (this.button) {
        this.button.setFillStyle(0x00aa00, 1);
      }
    });
    this.text.on("pointerdown", () => {
      if (this.onStart) {
        this.onStart();
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
    this.onStart = undefined;
  }

  isVisible(): boolean {
    return this.button !== undefined;
  }
}
