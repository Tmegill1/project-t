import Phaser from "phaser";
import "./style.css";
import BootScene from "./scenes/BootScene.ts";
import LoginScene from "./ui/login/LoginScene.ts";
import RegisterScene from "./ui/register/RegisterScene.ts";
import MainMenu from "./ui/mainMenu/MainMenu.ts";
import GameScene from "./scenes/GameScene.ts";
import UIScene from "./scenes/UIScene.ts";
import { GRID_COLS, GRID_ROWS, TILE_SIZE } from "./game/data/demoMap.ts";


// Create a mount point for Phaser
const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Missing #app element");

app.innerHTML = `<div id="game"></div>`;

// Base game dimensions (automatically calculated from map dimensions)
const BASE_WIDTH = GRID_COLS * TILE_SIZE;
const BASE_HEIGHT = GRID_ROWS * TILE_SIZE;

// Create the game first to access Phaser's device detection
const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: BASE_WIDTH,
  height: BASE_HEIGHT,
  parent: "game",
  backgroundColor: "#1e1e1e",
  scene: [BootScene, LoginScene, RegisterScene, MainMenu, GameScene, UIScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: BASE_WIDTH,
    height: BASE_HEIGHT,
    fullscreenTarget: "game",
  },
});

// Use Phaser's built-in device detection after game is created
const isDesktop = game.device.os.desktop;

if (!isDesktop) {
  // For non-desktop devices, allow auto rotation (any orientation)
  // By not setting orientation or locking it, the device can rotate freely
  // Just handle orientation changes to refresh the game scale
  
  // Handle orientation changes - refresh the game scale when device rotates
  window.addEventListener("orientationchange", () => {
    setTimeout(() => {
      game.scale.refresh();
    }, 100);
  });
  
  // Also listen to Phaser's orientation change event if available
  game.scale.on('orientationchange', () => {
    game.scale.refresh();
  });
}

// Handle window resize for all devices
window.addEventListener("resize", () => {
  game.scale.refresh();
});
