import Phaser from "phaser";

export class GameOverMenu {
  private scene: Phaser.Scene;
  private menu?: Phaser.GameObjects.Container;
  private overlay?: Phaser.GameObjects.Rectangle;
  private onPlayAgain?: () => void;
  private onGoHome?: () => void;

  constructor(
    scene: Phaser.Scene,
    onPlayAgain: () => void,
    onGoHome: () => void
  ) {
    this.scene = scene;
    this.onPlayAgain = onPlayAgain;
    this.onGoHome = onGoHome;
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

    // "You have lost!" text
    const gameOverText = this.scene.add.text(0, -100, "You have lost!", {
      fontSize: "48px",
      color: "#ff0000",
      fontStyle: "bold"
    });
    gameOverText.setOrigin(0.5, 0.5);

    // "Thank you for playing!" text
    const thankYouText = this.scene.add.text(0, -30, "Thank you for playing!", {
      fontSize: "24px",
      color: "#ffffff"
    });
    thankYouText.setOrigin(0.5, 0.5);

    // "Would you like to" text
    const questionText = this.scene.add.text(0, 20, "Would you like to", {
      fontSize: "20px",
      color: "#ffffff"
    });
    questionText.setOrigin(0.5, 0.5);

    // "Play Again" button (left)
    const playAgainButton = this.scene.add.rectangle(-80, 80, 140, 50, 0x00aa00, 1);
    playAgainButton.setStrokeStyle(2, 0xffffff, 1);
    playAgainButton.setInteractive({ useHandCursor: true });
    playAgainButton.on("pointerdown", () => {
      if (this.onPlayAgain) {
        this.onPlayAgain();
      }
    });

    const playAgainText = this.scene.add.text(-80, 80, "Play Again", {
      fontSize: "18px",
      color: "#ffffff",
      fontStyle: "bold"
    });
    playAgainText.setOrigin(0.5, 0.5);
    playAgainText.setInteractive({ useHandCursor: true });
    playAgainText.on("pointerdown", () => {
      if (this.onPlayAgain) {
        this.onPlayAgain();
      }
    });

    // "Home" button (right)
    const homeButton = this.scene.add.rectangle(80, 80, 140, 50, 0xaa0000, 1);
    homeButton.setStrokeStyle(2, 0xffffff, 1);
    homeButton.setInteractive({ useHandCursor: true });
    homeButton.on("pointerdown", () => {
      if (this.onGoHome) {
        this.onGoHome();
      }
    });

    const homeText = this.scene.add.text(80, 80, "Home", {
      fontSize: "18px",
      color: "#ffffff",
      fontStyle: "bold"
    });
    homeText.setOrigin(0.5, 0.5);
    homeText.setInteractive({ useHandCursor: true });
    homeText.on("pointerdown", () => {
      if (this.onGoHome) {
        this.onGoHome();
      }
    });

    // Add all menu elements to container
    this.menu.add([
      gameOverText,
      thankYouText,
      questionText,
      playAgainButton,
      playAgainText,
      homeButton,
      homeText
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
