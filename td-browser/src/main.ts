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

// Detect if user is on a mobile device
function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (window.innerWidth <= 768 && window.innerHeight <= 1024);
}

// Detect if device is in portrait orientation
function isPortrait(): boolean {
  return window.innerHeight > window.innerWidth;
}

const isMobile = isMobileDevice();
const isPortraitMode = isPortrait();

// For mobile in portrait, use FIT to show full game (may have letterboxing)
// For mobile in landscape, use ENVELOP to fill screen
// For desktop, use FIT mode to maintain aspect ratio with letterboxing
let scaleMode: number;
if (isMobile && !isPortraitMode) {
  scaleMode = Phaser.Scale.ENVELOP; // Landscape mobile: fill screen
} else {
  scaleMode = Phaser.Scale.FIT; // Portrait mobile or desktop: show full game
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: BASE_WIDTH,
  height: BASE_HEIGHT,
  parent: "game",
  backgroundColor: "#1e1e1e",
  scene: [BootScene, MainMenu, GameScene, UIScene],
  scale: {
    mode: scaleMode,
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
    // For mobile, allow the game to resize to fill the viewport
    ...(isMobile && {
      fullscreenTarget: "game",
    }),
  },
});

// Handle window resize
window.addEventListener("resize", () => {
  game.scale.refresh();
});
