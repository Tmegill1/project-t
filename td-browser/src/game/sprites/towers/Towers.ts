import Phaser from "phaser";
import { TILE_SIZE } from "../../data/demoMap";
import { BaseTower, type TowerConfig } from "./BaseTower";

// Basic Tower - balanced stats
export class BasicTower extends BaseTower {
  static readonly COST = 20;
  static readonly RANGE = 100;
  static readonly FIRE_RATE = 1000; // 1 second between shots
  static readonly COLOR = 0x0066ff; // Blue
  static readonly SIZE = 0.4;

  constructor(scene: Phaser.Scene, col: number, row: number) {
    const config: TowerConfig = {
      cost: BasicTower.COST,
      range: BasicTower.RANGE,
      fireRate: BasicTower.FIRE_RATE,
      color: BasicTower.COLOR,
      size: BasicTower.SIZE
    };
    
    const hexagon = createHexagon(scene, 17, 20, TILE_SIZE * config.size, config.color, 1);  // Creating hexagon at (17, 20) for each tile wwhich centers the hexagon in the tile.
    hexagon.setOrigin(0.5, 0.5);
    
    super(scene, col, row, config, hexagon);
  }
}

// Fast Tower - faster fire rate, less range
export class FastTower extends BaseTower {
  static readonly COST = 30;
  static readonly RANGE = 80;
  static readonly FIRE_RATE = 500;
  static readonly COLOR = 0x00ff00; // Green
  static readonly SIZE = 0.35;

  constructor(scene: Phaser.Scene, col: number, row: number) {
    const config: TowerConfig = {
      cost: FastTower.COST,
      range: FastTower.RANGE,
      fireRate: FastTower.FIRE_RATE,
      color: FastTower.COLOR,
      size: FastTower.SIZE
    };
    
    const hexagon = createHexagon(scene, 15, 17, TILE_SIZE * config.size, config.color, 1);
    hexagon.setOrigin(0.5, 0.5);
    
    super(scene, col, row, config, hexagon);
  }
}

// Long Range Tower - longer range, slower fire rate
export class LongRangeTower extends BaseTower {
  static readonly COST = 40;
  static readonly RANGE = 150;
  static readonly FIRE_RATE = 1500;
  static readonly COLOR = 0xff6600; // Orange
  static readonly SIZE = 0.45;

  constructor(scene: Phaser.Scene, col: number, row: number) {
    const config: TowerConfig = {
      cost: LongRangeTower.COST,
      range: LongRangeTower.RANGE,
      fireRate: LongRangeTower.FIRE_RATE,
      color: LongRangeTower.COLOR,
      size: LongRangeTower.SIZE
    };
    
    const hexagon = createHexagon(scene, 17, 20, TILE_SIZE * config.size, config.color, 1);
    hexagon.setOrigin(0.5, 0.5);
    
    super(scene, col, row, config, hexagon);
  }
}

// Helper function to create hexagon
// Creates a hexagon centered at (0, 0) - the points are relative to the polygon's position
function createHexagon(
  scene: Phaser.Scene,
  x: number,
  y: number,
  radius: number,
  fillColor: number,
  fillAlpha: number
): Phaser.GameObjects.Polygon {
  const points: Phaser.Geom.Point[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2; // Start from top
    // Points are relative to the polygon's position (x, y)
    // Since we want it centered, we calculate points relative to (0, 0)
    points.push(
      new Phaser.Geom.Point(
        radius * Math.cos(angle),
        radius * Math.sin(angle)
      )
    );
  }
  
  // Create polygon at (x, y) with points relative to that position
  // Setting origin to (0.5, 0.5) will center it on (x, y)
  const polygon = scene.add.polygon(x, y, points, fillColor, fillAlpha);
  return polygon;
}

// Default export for backwards compatibility
export default BasicTower;
