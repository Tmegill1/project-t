import Phaser from "phaser";

export default class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  preload() {
    // Day 1: no assets yet.
    // Later: this.load.image(...), this.load.audio(...), etc.
  }

  create() {
    this.scene.start("MainMenu");
  }
}
