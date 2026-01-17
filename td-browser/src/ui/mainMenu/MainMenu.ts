import Phaser from "phaser";

export default class MainMenu extends Phaser.Scene {
  constructor() {
    super("MainMenu");
  }

  create() {
    // Get screen center and dimensions
    const centerX = this.cameras.main.width / 2;
    const centerY = this.cameras.main.height / 2;
    const screenWidth = this.cameras.main.width;
    const screenHeight = this.cameras.main.height;
    
    // Detect if we're in a narrow/portrait viewport
    const isNarrow = screenWidth < screenHeight;
    
    // Adjust font sizes and spacing for mobile/narrow screens
    const titleFontSize = isNarrow ? Math.min(36, screenWidth / 8) : 48;
    const buttonWidth = isNarrow ? Math.min(180, screenWidth * 0.7) : 200;
    const buttonHeight = isNarrow ? Math.min(70, screenHeight * 0.1) : 80;
    const titleOffset = isNarrow ? Math.min(100, screenHeight * 0.15) : 150;

    // Create title text - ensure it fits on screen
    const titleText = this.add.text(centerX, centerY - titleOffset, "Tower Defense", {
      fontSize: `${titleFontSize}px`,
      color: "#ffffff",
      fontStyle: "bold"
    });
    titleText.setOrigin(0.5, 0.5);
    
    // Ensure title doesn't overflow - scale down if needed
    if (titleText.width > screenWidth * 0.9) {
      const scale = (screenWidth * 0.9) / titleText.width;
      titleText.setScale(scale);
    }

    // Create big green PLAY button
    const playButton = this.add.rectangle(centerX, centerY, buttonWidth, buttonHeight, 0x00aa00, 1);
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

    // Add "PLAY" text on button - scale font size with button
    const playFontSize = isNarrow ? Math.min(28, buttonHeight * 0.4) : 32;
    const playText = this.add.text(centerX, centerY, "PLAY", {
      fontSize: `${playFontSize}px`,
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
