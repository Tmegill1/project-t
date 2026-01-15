import Phaser from "phaser";
import { TILE_SIZE } from "../../data/demoMap";
import { BaseEnemy } from "./BaseEnemy";

export interface PathPoint {
  x: number;
  y: number;
}

// Circle Enemy - medium speed (100 pixels/second), 1 life loss, 5 health
export class CircleEnemy extends BaseEnemy {
  constructor(scene: Phaser.Scene, x: number, y: number, path: PathPoint[]) {
    const radius = TILE_SIZE * 0.35; // 35% of tile size
    const circle = new Phaser.GameObjects.Arc(scene, 0, 0, radius, 0, 360, false, 0xff0000, 1);
    
    super(scene, x, y, path, 100, 1, 5, circle);
  }
}

// Square Enemy - slower speed (60 pixels/second), 5 life loss, 8 health
export class SquareEnemy extends BaseEnemy {
  constructor(scene: Phaser.Scene, x: number, y: number, path: PathPoint[]) {
    const size = TILE_SIZE * 0.5; // 50% of tile size
    const square = new Phaser.GameObjects.Rectangle(scene, 0, 0, size, size, 0xff0000, 1);
    
    super(scene, x, y, path, 60, 5, 8, square);
  }
}

// Triangle Enemy - faster speed (150 pixels/second), 2 life loss, 3 health
export class TriangleEnemy extends BaseEnemy {
  constructor(scene: Phaser.Scene, x: number, y: number, path: PathPoint[]) {
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
    
    super(scene, x, y, path, 150, 2, 3, triangle);
  }
}

// Default export for backwards compatibility
export default CircleEnemy;
