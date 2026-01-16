import Phaser from "phaser";
import { TILE_SIZE } from "../../data/demoMap";
import { BaseEnemy } from "./BaseEnemy";

export interface PathPoint {
  x: number;
  y: number;
}

// Circle Enemy - medium speed (100 pixels/second), 1 life loss, 5 health, 5 money reward
export class CircleEnemy extends BaseEnemy {
  constructor(scene: Phaser.Scene, x: number, y: number, path: PathPoint[], speedModifier: number = 1, healthModifier: number = 1, currentWave: number = 1) {
    const radius = TILE_SIZE * 0.35; // 35% of tile size
    const circle = new Phaser.GameObjects.Arc(scene, 0, 0, radius, 0, 360, false, 0xff0000, 1);
    
    const baseSpeed = 100;
    const baseHealth = 5;
    const reward = 5; // Circle reward
    super(scene, x, y, path, baseSpeed * speedModifier, 1, Math.floor(baseHealth * healthModifier), circle, currentWave, reward);
  }
}

// Square Enemy - slower speed (60 pixels/second), 5 life loss, 8 health, 20 money reward
export class SquareEnemy extends BaseEnemy {
  constructor(scene: Phaser.Scene, x: number, y: number, path: PathPoint[], speedModifier: number = 1, healthModifier: number = 1, currentWave: number = 1) {
    const size = TILE_SIZE * 0.5; // 50% of tile size
    const square = new Phaser.GameObjects.Rectangle(scene, 0, 0, size, size, 0xff0000, 1);
    
    const baseSpeed = 60;
    const baseHealth = 8;
    const reward = 20; // Square reward
    super(scene, x, y, path, baseSpeed * speedModifier, 5, Math.floor(baseHealth * healthModifier), square, currentWave, reward);
  }
}

// Triangle Enemy - faster speed (150 pixels/second), 2 life loss, 3 health, 10 money reward
export class TriangleEnemy extends BaseEnemy {
  constructor(scene: Phaser.Scene, x: number, y: number, path: PathPoint[], speedModifier: number = 1, healthModifier: number = 1, currentWave: number = 1) {
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
    
    const baseSpeed = 150;
    const baseHealth = 3;
    const reward = 10; // Triangle reward
    super(scene, x, y, path, baseSpeed * speedModifier, 2, Math.floor(baseHealth * healthModifier), triangle, currentWave, reward);
  }
}

// Default export for backwards compatibility
export default CircleEnemy;
