import Phaser from "phaser";
import { authService } from "../../services/auth/AuthService";

export default class MainMenu extends Phaser.Scene {
  private logoutButton?: Phaser.GameObjects.Rectangle;
  private logoutButtonText?: Phaser.GameObjects.Text;

  constructor() {
    super("MainMenu");
  }

  create() {
    if (!authService.isAuthenticated()) {
      this.scene.start("Login");
      return;
    }
    
    // Use camera dimensions (works with Phaser.Scale.FIT)
    const screenWidth = this.cameras.main.width;
    const screenHeight = this.cameras.main.height;
    if (this.textures.exists("background")) {
      const bg = this.add.image(0, 0, "background");
      bg.setOrigin(0, 0);
      bg.setDisplaySize(screenWidth, screenHeight);
      bg.setDepth(-1); // Behind everything
      
      // Add dark overlay to dim the background
      const overlay = this.add.rectangle(0, 0, screenWidth, screenHeight, 0x000000, 0.5);
      overlay.setOrigin(0, 0);
      overlay.setDepth(-0.5); // Above background, below UI
    }
    
    // Get screen center and dimensions
    const centerX = screenWidth / 2;
    const centerY = screenHeight / 2;
    
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

    // Create logout button in bottom right
    const logoutButtonWidth = isNarrow ? 100 : 120;
    const logoutButtonHeight = isNarrow ? 35 : 40;
    this.logoutButton = this.add.rectangle(
      screenWidth - logoutButtonWidth / 2 - 10,
      screenHeight - logoutButtonHeight / 2 - 10,
      logoutButtonWidth,
      logoutButtonHeight,
      0x444444,
      1
    );
    this.logoutButton.setStrokeStyle(2, 0xffffff, 1);
    this.logoutButton.setInteractive({ useHandCursor: true });

    this.logoutButtonText = this.add.text(
      screenWidth - logoutButtonWidth / 2 - 10,
      screenHeight - logoutButtonHeight / 2 - 10,
      "Logout",
      {
        fontSize: "14px",
        color: "#ffffff"
      }
    );
    this.logoutButtonText.setOrigin(0.5, 0.5);
    this.logoutButtonText.setInteractive({ useHandCursor: true });

    // Logout button hover effects
    const setLogoutHover = (hover: boolean) => {
      if (this.logoutButton) {
        this.logoutButton.setFillStyle(hover ? 0x555555 : 0x444444, 1);
      }
    };

    this.logoutButton.on("pointerover", () => setLogoutHover(true));
    this.logoutButton.on("pointerout", () => setLogoutHover(false));
    this.logoutButtonText.on("pointerover", () => setLogoutHover(true));
    this.logoutButtonText.on("pointerout", () => setLogoutHover(false));

    // Logout button click handler
    const handleLogout = () => {
      this.logout();
    };

    this.logoutButton.on("pointerdown", handleLogout);
    this.logoutButtonText.on("pointerdown", handleLogout);
  }

  private logout() {
    authService.logout();
    this.scene.start("Login");
  }
}
