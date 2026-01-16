import Phaser from "phaser";

export default class MainMenu extends Phaser.Scene {
  constructor() {
    super("MainMenu");
  }

  create() {
    // Get screen center
    const centerX = this.cameras.main.width / 2;
    const centerY = this.cameras.main.height / 2;

    // Create title text (optional)
    const titleText = this.add.text(centerX, centerY - 150, "Tower Defense", {
      fontSize: "48px",
      color: "#ffffff",
      fontStyle: "bold"
    });
    titleText.setOrigin(0.5, 0.5);

    // Create big green PLAY button
    const playButton = this.add.rectangle(centerX, centerY, 200, 80, 0x00aa00, 1);
    playButton.setStrokeStyle(3, 0xffffff, 1);
    playButton.setInteractive({ useHandCursor: true });
    
    // Add hover effect
    playButton.on("pointerover", () => {
      playButton.setFillStyle(0x00cc00, 1);
    });
    playButton.on("pointerout", () => {
      playButton.setFillStyle(0x00aa00, 1);
    });
    
    // Start game when clicked
    playButton.on("pointerdown", () => {
      this.scene.start("Game");
      this.scene.launch("UI");
    });

    // Add "PLAY" text on button
    const playText = this.add.text(centerX, centerY, "PLAY", {
      fontSize: "32px",
      color: "#ffffff",
      fontStyle: "bold"
    });
    playText.setOrigin(0.5, 0.5);
    playText.setInteractive({ useHandCursor: true });
    
    // Make text also clickable
    playText.on("pointerover", () => {
      playButton.setFillStyle(0x00cc00, 1);
    });
    playText.on("pointerout", () => {
      playButton.setFillStyle(0x00aa00, 1);
    });
    playText.on("pointerdown", () => {
      this.scene.start("Game");
      this.scene.launch("UI");
    });
  }
}
