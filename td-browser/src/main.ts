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

new Phaser.Game({
  type: Phaser.AUTO,
  width: 23*48,
  height: 14*48,
  parent: "game",
  backgroundColor: "#1e1e1e",
  scene: [BootScene, MainMenu, GameScene, UIScene],
});
