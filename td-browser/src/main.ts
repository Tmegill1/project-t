import Phaser from "phaser";
import "./style.css";
import BootScene from "./scenes/BootScene.ts";
import MainMenu from "./ui/mainMenu/MainMenu.ts";
import GameScene from "./scenes/GameScene.ts";
import UIScene from "./scenes/UIScene.ts";


// Create a mount point for Phaser
const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Missing #app element");

app.innerHTML = `<div id="game"></div>`;

// Base game dimensions (your original grid size)
const BASE_WIDTH = 23 * 48;
const BASE_HEIGHT = 14 * 48;

// Create the game first to access Phaser's device detection
const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: BASE_WIDTH,
  height: BASE_HEIGHT,
  parent: "game",
  backgroundColor: "#1e1e1e",
  scene: [BootScene, MainMenu, GameScene, UIScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: BASE_WIDTH,
    height: BASE_HEIGHT,
    min: {
      width: BASE_WIDTH * 0.5,
      height: BASE_HEIGHT * 0.5,
    },
    max: {
      width: BASE_WIDTH * 2,
      height: BASE_HEIGHT * 2,
    },
  },
});

// Use Phaser's built-in device detection after game is created
const isDesktop = game.device.os.desktop;

if (!isDesktop) {
  // For non-desktop devices, allow auto rotation (any orientation)
  // Set orientation to ANY to allow both portrait and landscape
  if (game.scale.orientation !== undefined) {
    game.scale.orientation = Phaser.Scale.Orientation.ANY;
  }
  
  // Unlock orientation if it was previously locked, allowing auto rotation
  if (typeof game.scale.unlockOrientation === 'function') {
    try {
      game.scale.unlockOrientation();
    } catch (e) {
      // Unlock may not be needed or supported
      console.log("Orientation unlock not needed or not supported");
    }
  }
  
  // Handle orientation changes - refresh the game scale when device rotates
  window.addEventListener("orientationchange", () => {
    setTimeout(() => {
      game.scale.refresh();
    }, 100);
  });
}

// Handle window resize for all devices
window.addEventListener("resize", () => {
  game.scale.refresh();
});
