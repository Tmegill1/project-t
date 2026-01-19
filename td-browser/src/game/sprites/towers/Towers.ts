import Phaser from "phaser";
import { TILE_SIZE } from "../../data/map2";
import { BaseTower, type TowerConfig } from "./BaseTower";

// Basic Tower - balanced stats
export class BasicTower extends BaseTower {
  static readonly COST = 20;
  static readonly RANGE = 100;
  static readonly FIRE_RATE = 1000; // 1 second between shots
  static readonly COLOR = 0x0066ff; // Blue
  static readonly SIZE = 0.8;

  constructor(scene: Phaser.Scene, col: number, row: number) {
    const config: TowerConfig = {
      cost: BasicTower.COST,
      range: BasicTower.RANGE,
      fireRate: BasicTower.FIRE_RATE,
      color: BasicTower.COLOR,
      size: BasicTower.SIZE
    };
    
    // Try to use sprite sheet frame if available, otherwise fall back to hexagon
    let visual: Phaser.GameObjects.GameObject;
    const textureExists = scene.textures.exists("towers");
    console.log("BasicTower: Checking for sprite sheet 'towers', exists:", textureExists);
    if (textureExists) {
      // Frame 0 = Basic Tower
      const sprite = scene.add.sprite(0, 0, "towers", 0);
      sprite.setDisplaySize(TILE_SIZE * config.size, TILE_SIZE * config.size);
      sprite.setOrigin(0.5, 0.5);
      sprite.setAlpha(1); // Ensure full opacity
      sprite.setBlendMode(Phaser.BlendModes.NORMAL); // Use normal blend mode for transparency
      visual = sprite;
      console.log("BasicTower: Using sprite sheet frame 0");
    } else {
      const hexagon = createHexagon(scene, 0, 0, TILE_SIZE * config.size, config.color, 1);
      hexagon.setOrigin(0.5, 0.5);
      visual = hexagon;
      console.log("BasicTower: Using hexagon fallback");
    }
    
    super(scene, col, row, config, visual);
  }
}

// Fast Tower - faster fire rate, less range
export class FastTower extends BaseTower {
  static readonly COST = 50;
  static readonly RANGE = 80;
  static readonly FIRE_RATE = 500;
  static readonly COLOR = 0x00ff00; // Green
  static readonly SIZE = 0.75;

  constructor(scene: Phaser.Scene, col: number, row: number) {
    const config: TowerConfig = {
      cost: FastTower.COST,
      range: FastTower.RANGE,
      fireRate: FastTower.FIRE_RATE,
      color: FastTower.COLOR,
      size: FastTower.SIZE
    };
    
    // Try to use sprite sheet frame if available, otherwise fall back to hexagon
    let visual: Phaser.GameObjects.GameObject;
    const textureExists = scene.textures.exists("towers");
    console.log("FastTower: Checking for sprite sheet 'towers', exists:", textureExists);
    if (textureExists) {
      // Frame 1 = Fast Tower
      const sprite = scene.add.sprite(0, 0, "towers", 1);
      sprite.setDisplaySize(TILE_SIZE * config.size, TILE_SIZE * config.size);
      sprite.setOrigin(0.5, 0.5);
      sprite.setAlpha(1); // Ensure full opacity
      sprite.setBlendMode(Phaser.BlendModes.NORMAL); // Use normal blend mode for transparency
      visual = sprite;
      console.log("FastTower: Using sprite sheet frame 1");
    } else {
      const hexagon = createHexagon(scene, 0, 0, TILE_SIZE * config.size, config.color, 1);
      hexagon.setOrigin(0.5, 0.5);
      visual = hexagon;
      console.log("FastTower: Using hexagon fallback");
    }
    
    super(scene, col, row, config, visual);
  }
}

// Long Range Tower - longer range, slower fire rate
export class LongRangeTower extends BaseTower {
  static readonly COST = 100;
  static readonly RANGE = 150;
  static readonly FIRE_RATE = 1500;
  static readonly COLOR = 0xff6600; // Orange
  static readonly SIZE = 0.85;

  constructor(scene: Phaser.Scene, col: number, row: number) {
    const config: TowerConfig = {
      cost: LongRangeTower.COST,
      range: LongRangeTower.RANGE,
      fireRate: LongRangeTower.FIRE_RATE,
      color: LongRangeTower.COLOR,
      size: LongRangeTower.SIZE
    };
    
    // Try to use sprite sheet frame if available, otherwise fall back to hexagon
    let visual: Phaser.GameObjects.GameObject;
    const textureExists = scene.textures.exists("towers");
    console.log("LongRangeTower: Checking for sprite sheet 'towers', exists:", textureExists);
    if (textureExists) {
      // Frame 2 = Long Range Tower
      const sprite = scene.add.sprite(0, 0, "towers", 2);
      sprite.setDisplaySize(TILE_SIZE * config.size, TILE_SIZE * config.size);
      sprite.setOrigin(0.5, 0.5);
      sprite.setAlpha(1); // Ensure full opacity
      sprite.setBlendMode(Phaser.BlendModes.NORMAL); // Use normal blend mode for transparency
      visual = sprite;
      console.log("LongRangeTower: Using sprite sheet frame 2");
    } else {
      const hexagon = createHexagon(scene, 0, 0, TILE_SIZE * config.size, config.color, 1);
      hexagon.setOrigin(0.5, 0.5);
      visual = hexagon;
      console.log("LongRangeTower: Using hexagon fallback");
    }
    
    super(scene, col, row, config, visual);
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
