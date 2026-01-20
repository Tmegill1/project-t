import Phaser from "phaser";

export class CongratulationsMenu {
  private scene: Phaser.Scene;
  private menu?: Phaser.GameObjects.Container;
  private overlay?: Phaser.GameObjects.Rectangle;
  private onNextMap?: () => void;
  private onExit?: () => void;

  constructor(
    scene: Phaser.Scene,
    onNextMap: () => void,
    onExit: () => void
  ) {
    this.scene = scene;
    this.onNextMap = onNextMap;
    this.onExit = onExit;
  }

  show() {
    if (this.menu) {
      return; // Already showing
    }

    const centerX = this.scene.cameras.main.width / 2;
    const centerY = this.scene.cameras.main.height / 2;

    // Create semi-transparent background overlay
    this.overlay = this.scene.add.rectangle(
      centerX,
      centerY,
      this.scene.cameras.main.width,
      this.scene.cameras.main.height,
      0x000000,
      0.7
    );
    this.overlay.setScrollFactor(0);
    this.overlay.setDepth(4000);

    // Create menu container
    this.menu = this.scene.add.container(centerX, centerY);
    this.menu.setScrollFactor(0);
    this.menu.setDepth(4001);

    // "Congratulations!" text - big bold font
    const congratsText = this.scene.add.text(0, -100, "Congratulations!", {
      fontSize: "48px",
      color: "#00ff00",
      fontStyle: "bold"
    });
    congratsText.setOrigin(0.5, 0.5);

    // "You completed all waves!" text
    const completedText = this.scene.add.text(0, -30, "You completed all waves!", {
      fontSize: "24px",
      color: "#ffffff"
    });
    completedText.setOrigin(0.5, 0.5);

    // "Next Map" button (left)
    const nextMapButton = this.scene.add.rectangle(-80, 80, 140, 50, 0x00aa00, 1);
    nextMapButton.setStrokeStyle(2, 0xffffff, 1);
    nextMapButton.setInteractive({ useHandCursor: true });
    nextMapButton.on("pointerdown", () => {
      if (this.onNextMap) {
        this.onNextMap();
      }
    });

    const nextMapText = this.scene.add.text(-80, 80, "Next Map", {
      fontSize: "18px",
      color: "#ffffff",
      fontStyle: "bold"
    });
    nextMapText.setOrigin(0.5, 0.5);
    nextMapText.setInteractive({ useHandCursor: true });
    nextMapText.on("pointerdown", () => {
      if (this.onNextMap) {
        this.onNextMap();
      }
    });

    // "Exit" button (right)
    const exitButton = this.scene.add.rectangle(80, 80, 140, 50, 0xaa0000, 1);
    exitButton.setStrokeStyle(2, 0xffffff, 1);
    exitButton.setInteractive({ useHandCursor: true });
    exitButton.on("pointerdown", () => {
      if (this.onExit) {
        this.onExit();
      }
    });

    const exitText = this.scene.add.text(80, 80, "Exit", {
      fontSize: "18px",
      color: "#ffffff",
      fontStyle: "bold"
    });
    exitText.setOrigin(0.5, 0.5);
    exitText.setInteractive({ useHandCursor: true });
    exitText.on("pointerdown", () => {
      if (this.onExit) {
        this.onExit();
      }
    });

    // Add all menu elements to container
    this.menu.add([
      congratsText,
      completedText,
      nextMapButton,
      nextMapText,
      exitButton,
      exitText
    ]);
  }

  hide() {
    if (this.menu) {
      this.menu.destroy();
      this.menu = undefined;
    }
    if (this.overlay) {
      this.overlay.destroy();
      this.overlay = undefined;
    }
  }

  isVisible(): boolean {
    return this.menu !== undefined;
  }
}
