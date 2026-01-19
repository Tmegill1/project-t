import Phaser from "phaser";
import { authService } from "../../services/auth/AuthService";
import { validateUsername, validatePassword } from "../../utils/validation";

export default class LoginScene extends Phaser.Scene {
  private usernameText?: Phaser.GameObjects.Text;
  private passwordText?: Phaser.GameObjects.Text;
  private usernameInput?: Phaser.GameObjects.Text;
  private passwordInput?: Phaser.GameObjects.Text;
  private loginButton?: Phaser.GameObjects.Rectangle;
  private loginButtonText?: Phaser.GameObjects.Text;
  private registerButton?: Phaser.GameObjects.Rectangle;
  private registerButtonText?: Phaser.GameObjects.Text;
  private errorText?: Phaser.GameObjects.Text;
  private cursor?: Phaser.GameObjects.Rectangle;
  private cursorBlinkOn: boolean = true;
  private currentUsername: string = "";
  private currentPassword: string = "";
  private isTypingUsername: boolean = true;
  private isLoading: boolean = false;

  constructor() {
    super("Login");
  }

  create() {
    // Clear username and password fields when scene is created (e.g., after logout)
    this.currentUsername = "";
    this.currentPassword = "";
    this.isTypingUsername = true;
    
    if (authService.isAuthenticated()) {
      this.scene.start("MainMenu");
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
    
    // Adjust sizes for mobile/narrow screens
    const titleFontSize = isNarrow ? Math.min(32, screenWidth / 10) : 40;
    const inputWidth = isNarrow ? Math.min(280, screenWidth * 0.8) : 320;
    const buttonWidth = isNarrow ? Math.min(200, screenWidth * 0.7) : 240;
    const buttonHeight = isNarrow ? 45 : 50;
    const spacing = isNarrow ? 50 : 60;

    // Create title
    const titleText = this.add.text(centerX, centerY - spacing * 2.5, "Login", {
      fontSize: `${titleFontSize}px`,
      color: "#ffffff",
      fontStyle: "bold"
    });
    titleText.setOrigin(0.5, 0.5);

    // Create username label and input
    const usernameY = centerY - spacing;
    const softFont = "Segoe UI, Arial, sans-serif";
    this.usernameText = this.add.text(centerX - inputWidth / 2, usernameY - 25, "Username:", {
      fontSize: "16px",
      color: "#ffffff",
      fontFamily: softFont
    });
    this.usernameText.setOrigin(0, 0.75);

    // Username input background
    const usernameBg = this.add.rectangle(centerX, usernameY, inputWidth, 40, 0x2a2a2a, 1);
    usernameBg.setStrokeStyle(2, 0x555555, 1);
    usernameBg.setInteractive({ useHandCursor: true });
    usernameBg.on("pointerdown", () => {
      this.isTypingUsername = true;
      // Clear placeholder if it's showing
      if (!this.currentUsername) {
        this.currentUsername = "";
      }
      this.updateInputDisplay();
    });

    this.usernameInput = this.add.text(centerX - inputWidth / 2 + 10, usernameY, "", {
      fontSize: "16px",
      color: "#ffffff",
      fontFamily: softFont
    });
    this.usernameInput.setOrigin(0, 0.5);

    // Create password label and input
    const passwordY = centerY;
    this.passwordText = this.add.text(centerX - inputWidth / 2, passwordY - 25, "Password:", {
      fontSize: "16px",
      color: "#ffffff",
      fontFamily: softFont
    });
    this.passwordText.setOrigin(0, .75);

    // Password input background
    const passwordBg = this.add.rectangle(centerX, passwordY, inputWidth, 40, 0x2a2a2a, 1);
    passwordBg.setStrokeStyle(2, 0x555555, 1);
    passwordBg.setInteractive({ useHandCursor: true });
    passwordBg.on("pointerdown", () => {
      this.isTypingUsername = false;
      // Clear placeholder if it's showing
      if (!this.currentPassword) {
        this.currentPassword = "";
      }
      this.updateInputDisplay();
    });

    this.passwordInput = this.add.text(centerX - inputWidth / 2 + 10, passwordY, "", {
      fontSize: "16px",
      color: "#ffffff",
      fontFamily: softFont
    });
    this.passwordInput.setOrigin(0, 0.5);

    // Error message (hidden by default)
    this.errorText = this.add.text(centerX, passwordY + 30, "", {
      fontSize: "14px",
      color: "#ff4444",
      wordWrap: { width: inputWidth }
    });
    this.errorText.setOrigin(0.5, 0);
    this.errorText.setVisible(false);

    // Blinking cursor for the active input field
    this.cursor = this.add.rectangle(0, 0, 2, 18, 0xffffff, 1).setOrigin(0, 0.5);
    this.cursorBlinkOn = true;
    this.time.addEvent({
      delay: 530,
      callback: () => {
        this.cursorBlinkOn = !this.cursorBlinkOn;
        if (this.cursor) {
          this.cursor.setVisible(!this.isLoading && this.cursorBlinkOn);
        }
      },
      loop: true
    });

    // Create login button
    const buttonY = centerY + spacing * 1.5;
    this.loginButton = this.add.rectangle(centerX, buttonY, buttonWidth, buttonHeight, 0x00aa00, 1);
    this.loginButton.setStrokeStyle(2, 0xffffff, 1);
    this.loginButton.setInteractive({ useHandCursor: true });

    this.loginButtonText = this.add.text(centerX, buttonY, "Login", {
      fontSize: "20px",
      color: "#ffffff",
      fontStyle: "bold"
    });
    this.loginButtonText.setOrigin(0.5, 0.5);
    this.loginButtonText.setInteractive({ useHandCursor: true });

    // Button hover effects
    const setButtonHover = (hover: boolean) => {
      if (this.loginButton) {
        this.loginButton.setFillStyle(hover ? 0x00cc00 : 0x00aa00, 1);
      }
    };

    this.loginButton.on("pointerover", () => setButtonHover(true));
    this.loginButton.on("pointerout", () => setButtonHover(false));
    this.loginButtonText.on("pointerover", () => setButtonHover(true));
    this.loginButtonText.on("pointerout", () => setButtonHover(false));

    // Login button: POST to API, then go to MainMenu on success
    const handleLogin = () => {
      if (this.isLoading) return;
      this.attemptLogin();
    };

    this.loginButton.on("pointerdown", handleLogin);
    this.loginButtonText.on("pointerdown", handleLogin);

    // Create register button (below login button)
    const registerY = buttonY + spacing;
    this.registerButton = this.add.rectangle(centerX, registerY, buttonWidth, buttonHeight, 0x444444, 1);
    this.registerButton.setStrokeStyle(2, 0xffffff, 1);
    this.registerButton.setInteractive({ useHandCursor: true });

    this.registerButtonText = this.add.text(centerX, registerY, "Register", {
      fontSize: "18px",
      color: "#ffffff"
    });
    this.registerButtonText.setOrigin(0.5, 0.5);
    this.registerButtonText.setInteractive({ useHandCursor: true });

    // Register button hover effects
    const setRegisterHover = (hover: boolean) => {
      if (this.registerButton) {
        this.registerButton.setFillStyle(hover ? 0x555555 : 0x444444, 1);
      }
    };

    this.registerButton.on("pointerover", () => setRegisterHover(true));
    this.registerButton.on("pointerout", () => setRegisterHover(false));
    this.registerButtonText.on("pointerover", () => setRegisterHover(true));
    this.registerButtonText.on("pointerout", () => setRegisterHover(false));

    // Register button: navigate to Register page
    const handleRegister = () => {
      this.scene.start("Register");
    };

    this.registerButton.on("pointerdown", handleRegister);
    this.registerButtonText.on("pointerdown", handleRegister);

    // Handle keyboard input
    this.input.keyboard?.on("keydown", async (event: KeyboardEvent) => {
      const isModifierPressed = event.ctrlKey || event.metaKey;
      
      // Keyboard shortcuts (Ctrl/Cmd + key)
      if (isModifierPressed) {
        event.preventDefault();
        if (event.key.toLowerCase() === "a") {
          // Select all: Copy current field's text to clipboard (for now, just focus the field)
          // In a real implementation, you'd highlight the text
          this.updateInputDisplay();
        } else if (event.key.toLowerCase() === "c") {
          // Copy: Copy current field's text to clipboard
          const textToCopy = this.isTypingUsername ? this.currentUsername : this.currentPassword;
          if (textToCopy && navigator.clipboard) {
            try {
              await navigator.clipboard.writeText(textToCopy);
            } catch (err) {
              console.error("Failed to copy:", err);
            }
          }
        } else if (event.key.toLowerCase() === "v") {
          // Paste: Paste from clipboard into current field
          if (navigator.clipboard) {
            try {
              const clipboardText = await navigator.clipboard.readText();
              if (this.isTypingUsername) {
                this.currentUsername = clipboardText;
              } else {
                this.currentPassword = clipboardText;
              }
              this.updateInputDisplay();
            } catch (err) {
              console.error("Failed to paste:", err);
            }
          }
        } else if (event.key.toLowerCase() === "x") {
          // Cut: Copy current field's text to clipboard and clear it
          const textToCut = this.isTypingUsername ? this.currentUsername : this.currentPassword;
          if (textToCut && navigator.clipboard) {
            try {
              await navigator.clipboard.writeText(textToCut);
              if (this.isTypingUsername) {
                this.currentUsername = "";
              } else {
                this.currentPassword = "";
              }
              this.updateInputDisplay();
            } catch (err) {
              console.error("Failed to cut:", err);
            }
          }
        }
        return;
      }
      
      if (event.key === "Tab") {
        event.preventDefault(); // Prevent browser default tab behavior
        // Switch between username and password fields
        if (this.isTypingUsername) {
          this.isTypingUsername = false;
          if (!this.currentPassword) {
            this.currentPassword = "";
          }
        } else {
          this.isTypingUsername = true;
          if (!this.currentUsername) {
            this.currentUsername = "";
          }
        }
        this.updateInputDisplay();
      } else if (event.key === "Enter") {
        if (!this.isLoading) this.attemptLogin();
      } else if (event.key === "Escape") {
        // Allow Escape to work for other menus, but not needed here
      } else if (event.key === "Backspace") {
        if (this.isTypingUsername) {
          this.currentUsername = this.currentUsername.slice(0, -1);
        } else {
          this.currentPassword = this.currentPassword.slice(0, -1);
        }
        this.updateInputDisplay();
      } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
        if (this.isTypingUsername) {
          this.currentUsername += event.key;
        } else {
          this.currentPassword += event.key;
        }
        this.updateInputDisplay();
      }
    });

    // Initialize input display
    this.isTypingUsername = true;
    this.updateInputDisplay();
  }

  private updateInputDisplay() {
    if (this.usernameInput) {
      // Show placeholder if username field is NOT selected and is empty
      // Show actual text if field IS selected or has content
      const displayText = (!this.isTypingUsername && !this.currentUsername) 
        ? "Enter username" 
        : this.currentUsername;
      this.usernameInput.setText(displayText);
      this.usernameInput.setAlpha(this.currentUsername ? 1 : 0.5);
    }
    
    if (this.passwordInput) {
      // Show placeholder if password field is NOT selected and is empty
      // Show actual text (masked) if field IS selected or has content
      const displayPassword = (this.isTypingUsername && !this.currentPassword)
        ? "Enter password"
        : "*".repeat(this.currentPassword.length);
      this.passwordInput.setText(displayPassword);
      this.passwordInput.setAlpha(this.currentPassword ? 1 : 0.5);
    }

    this.updateCursorPosition();
  }

  private updateCursorPosition() {
    if (!this.cursor || !this.usernameInput || !this.passwordInput) return;
    const pad = 2; // Small gap between text and cursor
    // Position cursor at the end of the text (follows as user types)
    if (this.isTypingUsername) {
      const textWidth = this.currentUsername ? this.usernameInput.width : 0;
      this.cursor.setPosition(this.usernameInput.x + textWidth + pad, this.usernameInput.y);
    } else {
      const textWidth = this.currentPassword ? this.passwordInput.width : 0;
      this.cursor.setPosition(this.passwordInput.x + textWidth + pad, this.passwordInput.y);
    }
    this.cursor.setVisible(!this.isLoading && this.cursorBlinkOn);
  }

  private setLoading(loading: boolean) {
    this.isLoading = loading;
    if (this.loginButtonText) this.loginButtonText.setText(loading ? "Loading..." : "Login");
    if (this.loginButton) this.loginButton.setInteractive({ useHandCursor: !loading });
    if (this.registerButton) this.registerButton.setInteractive({ useHandCursor: !loading });
    if (this.cursor) this.cursor.setVisible(loading ? false : this.cursorBlinkOn);
  }

  private showError(msg: string) {
    if (this.errorText) {
      this.errorText.setText(msg);
      this.errorText.setVisible(true);
    }
  }

  private hideError() {
    if (this.errorText) this.errorText.setVisible(false);
  }

  private async attemptLogin() {
    const u = this.currentUsername.trim();
    const p = this.currentPassword;
    
    // Validate input before sending to server
    const usernameValidation = validateUsername(u);
    if (!usernameValidation.isValid) {
      this.showError(usernameValidation.error || "Invalid username");
      return;
    }

    const passwordValidation = validatePassword(p);
    if (!passwordValidation.isValid) {
      this.showError(passwordValidation.error || "Invalid password");
      return;
    }

    this.setLoading(true);
    this.hideError();
    const res = await authService.login({ username: u, password: p });
    this.setLoading(false);
    if (res.success) {
      this.navigateToMainMenu();
    } else {
      this.showError(res.error || "Login failed");
    }
  }

  private navigateToMainMenu() {
    this.scene.start("MainMenu");
  }
}
