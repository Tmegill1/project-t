import Phaser from "phaser";

export class GameMenu {
  private scene: Phaser.Scene;
  private menuContainer?: Phaser.GameObjects.Container;
  private overlay?: Phaser.GameObjects.Rectangle;
  private isPaused: boolean = false;
  private onContinue?: () => void;
  private onRestart?: () => void;
  private onQuit?: () => void;
  private onPauseStateChange?: (isPaused: boolean) => void;

  constructor(
    scene: Phaser.Scene,
    onContinue?: () => void,
    onRestart?: () => void,
    onQuit?: () => void,
    onPauseStateChange?: (isPaused: boolean) => void
  ) {
    this.scene = scene;
    this.onContinue = onContinue;
    this.onRestart = onRestart;
    this.onQuit = onQuit;
    this.onPauseStateChange = onPauseStateChange;
  }

  setupEscapeKey(canShowMenu: () => boolean) {
    // Listen for Escape key
    this.scene.input.keyboard?.on("keydown-ESC", () => {
      // Only show menu if nothing else is selected and menu isn't already showing
      if (!this.isPaused && canShowMenu()) {
        this.showMenu();
      } else if (this.isPaused) {
        this.hideMenu();
      }
    });
  }

  showMenu() {
    if (this.isPaused || this.menuContainer) {
      return; // Already showing menu
    }
    
    this.isPaused = true;
    
    // Pause all timers in the scene
    this.scene.time.paused = true;
    
    // Notify that pause state changed
    if (this.onPauseStateChange) {
      this.onPauseStateChange(true);
    }
    
    // Get screen center
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
    this.overlay.setDepth(5000);
    
    // Create menu container
    this.menuContainer = this.scene.add.container(centerX, centerY);
    this.menuContainer.setScrollFactor(0);
    this.menuContainer.setDepth(5001);
    
    // "Paused" title
    const titleText = this.scene.add.text(0, -120, "Paused", {
      fontSize: "48px",
      color: "#ffffff",
      fontStyle: "bold"
    });
    titleText.setOrigin(0.5, 0.5);
    
    // "Continue" button
    const continueButton = this.scene.add.rectangle(0, -30, 200, 50, 0x00aa00, 1);
    continueButton.setStrokeStyle(2, 0xffffff, 1);
    continueButton.setInteractive({ useHandCursor: true });
    continueButton.on("pointerdown", () => {
      this.hideMenu();
      if (this.onContinue) {
        this.onContinue();
      }
    });
    
    const continueText = this.scene.add.text(0, -30, "Continue", {
      fontSize: "20px",
      color: "#ffffff",
      fontStyle: "bold"
    });
    continueText.setOrigin(0.5, 0.5);
    continueText.setInteractive({ useHandCursor: true });
    continueText.on("pointerdown", () => {
      this.hideMenu();
      if (this.onContinue) {
        this.onContinue();
      }
    });
    
    // "Restart" button
    const restartButton = this.scene.add.rectangle(0, 40, 200, 50, 0xaa8800, 1);
    restartButton.setStrokeStyle(2, 0xffffff, 1);
    restartButton.setInteractive({ useHandCursor: true });
    restartButton.on("pointerdown", () => {
      this.hideMenu();
      if (this.onRestart) {
        this.onRestart();
      }
    });
    
    const restartText = this.scene.add.text(0, 40, "Restart", {
      fontSize: "20px",
      color: "#ffffff",
      fontStyle: "bold"
    });
    restartText.setOrigin(0.5, 0.5);
    restartText.setInteractive({ useHandCursor: true });
    restartText.on("pointerdown", () => {
      this.hideMenu();
      if (this.onRestart) {
        this.onRestart();
      }
    });
    
    // "Quit" button
    const quitButton = this.scene.add.rectangle(0, 110, 200, 50, 0xaa0000, 1);
    quitButton.setStrokeStyle(2, 0xffffff, 1);
    quitButton.setInteractive({ useHandCursor: true });
    quitButton.on("pointerdown", () => {
      this.hideMenu();
      if (this.onQuit) {
        this.onQuit();
      }
    });
    
    const quitText = this.scene.add.text(0, 110, "Quit", {
      fontSize: "20px",
      color: "#ffffff",
      fontStyle: "bold"
    });
    quitText.setOrigin(0.5, 0.5);
    quitText.setInteractive({ useHandCursor: true });
    quitText.on("pointerdown", () => {
      this.hideMenu();
      if (this.onQuit) {
        this.onQuit();
      }
    });
    
    // Add all menu elements to container
    this.menuContainer.add([
      titleText,
      continueButton,
      continueText,
      restartButton,
      restartText,
      quitButton,
      quitText
    ]);
  }

  hideMenu() {
    if (!this.isPaused) {
      return;
    }
    
    this.isPaused = false;
    
    // Resume all timers in the scene
    this.scene.time.paused = false;
    
    // Notify that pause state changed
    if (this.onPauseStateChange) {
      this.onPauseStateChange(false);
    }
    
    if (this.menuContainer) {
      this.menuContainer.destroy();
      this.menuContainer = undefined;
    }
    
    if (this.overlay) {
      this.overlay.destroy();
      this.overlay = undefined;
    }
  }

  isMenuVisible(): boolean {
    return this.isPaused;
  }

  destroy() {
    this.hideMenu();
  }
}
