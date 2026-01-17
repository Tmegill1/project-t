import Phaser from "phaser";
import { TILE_SIZE } from "../../data/demoMap";
import { BaseEnemy } from "./BaseEnemy";

export interface PathPoint {
  x: number;
  y: number;
}

// Slime Enemy (replaces Circle) - medium speed (100 pixels/second), 1 life loss, 5 health, 5 money reward
export class CircleEnemy extends BaseEnemy {
  constructor(scene: Phaser.Scene, x: number, y: number, path: PathPoint[], speedModifier: number = 1, healthModifier: number = 1, currentWave: number = 1) {
    const baseSpeed = 100;
    const baseHealth = 5;
    const reward = 5; // Circle reward
    
    // Try to use animated sprite if available, otherwise fall back to circle shape
    let visual: Phaser.GameObjects.GameObject;
    if (scene.textures.exists("slime-walk-down")) {
      const sprite = scene.add.sprite(0, 0, "slime-walk-down", 0);
      const size = TILE_SIZE * 0.7; // 70% of tile size for sprite
      sprite.setDisplaySize(size, size);
      sprite.setOrigin(0.5, 0.5);
      // Make sure sprite is ready before playing animation
      sprite.setFrame(0);
      visual = sprite;
    } else {
      const radius = TILE_SIZE * 0.35; // 35% of tile size
      const circle = new Phaser.GameObjects.Arc(scene, 0, 0, radius, 0, 360, false, 0xff0000, 1);
      visual = circle;
    }
    
    super(scene, x, y, path, baseSpeed * speedModifier, 1, Math.floor(baseHealth * healthModifier), visual, currentWave, reward, "slime");
  }
}

// Ogre Enemy (replaces Square) - slower speed (60 pixels/second), 5 life loss, 8 health, 20 money reward
export class SquareEnemy extends BaseEnemy {
  constructor(scene: Phaser.Scene, x: number, y: number, path: PathPoint[], speedModifier: number = 1, healthModifier: number = 1, currentWave: number = 1) {
    const baseSpeed = 60;
    const baseHealth = 8;
    const reward = 20; // Square reward
    
    // Try to use animated sprite if available, otherwise fall back to rectangle shape
    let visual: Phaser.GameObjects.GameObject;
    if (scene.textures.exists("ogre-walk-down")) {
      const sprite = scene.add.sprite(0, 0, "ogre-walk-down", 0);
      const size = TILE_SIZE * 1.2; // 120% of tile size for ogre (bigger than other enemies)
      sprite.setDisplaySize(size, size);
      sprite.setOrigin(0.5, 0.5);
      sprite.setFrame(0);
      sprite.setFlipX(true); // Flip horizontally (180 degrees around y-axis)
      visual = sprite;
    } else {
      const size = TILE_SIZE * 0.5; // 50% of tile size
      const square = new Phaser.GameObjects.Rectangle(scene, 0, 0, size, size, 0xff0000, 1);
      visual = square;
    }
    
    super(scene, x, y, path, baseSpeed * speedModifier, 5, Math.floor(baseHealth * healthModifier), visual, currentWave, reward, "ogre");
  }
}

// Bee Enemy (replaces Triangle) - faster speed (150 pixels/second), 2 life loss, 3 health, 10 money reward
export class TriangleEnemy extends BaseEnemy {
  constructor(scene: Phaser.Scene, x: number, y: number, path: PathPoint[], speedModifier: number = 1, healthModifier: number = 1, currentWave: number = 1) {
    const baseSpeed = 150;
    const baseHealth = 3;
    const reward = 10; // Triangle reward
    
    // Try to use animated sprite if available, otherwise fall back to triangle shape
    let visual: Phaser.GameObjects.GameObject;
    if (scene.textures.exists("bee-walk-down")) {
      const sprite = scene.add.sprite(0, 0, "bee-walk-down", 0);
      const size = TILE_SIZE * 0.7; // 70% of tile size for sprite
      sprite.setDisplaySize(size, size);
      sprite.setOrigin(0.5, 0.5);
      sprite.setFrame(0);
      visual = sprite;
    } else {
      const size = TILE_SIZE * 0.4; // 40% of tile size
      const triangle = new Phaser.GameObjects.Triangle(
        scene,
        0,
        0,
        0, -size / 2,        // top point
        -size / 2, size / 2, // bottom left
        size / 2, size / 2,  // bottom right
        0xff0000,
        1
      );
      visual = triangle;
    }
    
    super(scene, x, y, path, baseSpeed * speedModifier, 2, Math.floor(baseHealth * healthModifier), visual, currentWave, reward, "bee");
  }
}

// Default export for backwards compatibility
export default CircleEnemy;
