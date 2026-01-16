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

// Calculate scale to fit window while maintaining aspect ratio
function getGameDimensions() {
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;
  const aspectRatio = BASE_WIDTH / BASE_HEIGHT;
  const windowAspectRatio = windowWidth / windowHeight;

  let width: number;
  let height: number;

  if (windowAspectRatio > aspectRatio) {
    // Window is wider - fit to height
    height = windowHeight;
    width = height * aspectRatio;
  } else {
    // Window is taller - fit to width
    width = windowWidth;
    height = width / aspectRatio;
  }

  return { width: Math.floor(width), height: Math.floor(height) };
}

const { width, height } = getGameDimensions();

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

// Handle window resize
window.addEventListener("resize", () => {
  game.scale.refresh();
});
