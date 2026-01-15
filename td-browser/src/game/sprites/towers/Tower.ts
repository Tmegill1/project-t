import Phaser from "phaser";
import { TILE_SIZE } from "../../data/demoMap";
import { tileToWorldCenter } from "../../map/Grid";
import { BaseEnemy } from "../enemies/BaseEnemy";
import Projectile from "./Projectile";

export default class Tower extends Phaser.GameObjects.Container {
  private range: number = 100;
  private fireRate: number = 1000; // milliseconds between shots
  private lastFireTime: number = 0;
  private currentTarget: BaseEnemy | null = null;
  private rangeCircle?: Phaser.GameObjects.Arc;
  private sceneRef: Phaser.Scene;
  private col: number;
  private row: number;

  constructor(scene: Phaser.Scene, col: number, row: number) {
    try {
      const worldPos = tileToWorldCenter(col, row);
      
      // Create blue hexagon centered at (0, 0) relative to container
      const hexagon = createHexagon(scene, 9, 10, TILE_SIZE * 0.4, 0x0066ff, 1);
      // Set hexagon origin to center so it's properly centered
      hexagon.setOrigin(0.5, 0.5);
      
      // Position container at tile center
      // Container's position is its origin, so we position it at the tile center
      super(scene, worldPos.x, worldPos.y, [hexagon]);
      
      this.sceneRef = scene;
      this.col = col;
      this.row = row;
      
      scene.add.existing(this);
      this.setDepth(600); // Above enemies
      
      // Create range circle (hidden by default)
      this.rangeCircle = scene.add.circle(worldPos.x, worldPos.y, this.range, 0x0066ff, 0.2);
      if (this.rangeCircle) {
        this.rangeCircle.setStrokeStyle(2, 0x0066ff, 0.5);
        this.rangeCircle.setDepth(550);
        this.rangeCircle.setVisible(false);
      }
    } catch (error) {
      console.error("Error creating Tower:", error);
      throw error;
    }
  }

  update(time: number, _delta: number, enemies: Phaser.GameObjects.Group) {
    // Find target if we don't have one or current target is out of range/destroyed
    if (!this.currentTarget || !this.isTargetValid(this.currentTarget, enemies)) {
      this.currentTarget = this.findTarget(enemies);
    }

    // Shoot at target if we have one and enough time has passed
    if (this.currentTarget && time - this.lastFireTime >= this.fireRate) {
      this.shoot(this.currentTarget);
      this.lastFireTime = time;
    }
  }

  private isTargetValid(target: BaseEnemy, enemies: Phaser.GameObjects.Group): boolean {
    // Check if target still exists in the group
    if (!enemies.contains(target)) {
      return false;
    }

    // Check if target is in range
    const distance = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      (target as any).visual.x,
      (target as any).visual.y
    );
    
    return distance <= this.range;
  }

  private findTarget(enemies: Phaser.GameObjects.Group): BaseEnemy | null {
    let closestEnemy: BaseEnemy | null = null;
    let closestDistance = this.range;

    enemies.children.entries.forEach((child) => {
      if (child instanceof BaseEnemy) {
        const enemyVisual = (child as any).visual;
        const distance = Phaser.Math.Distance.Between(
          this.x,
          this.y,
          enemyVisual.x,
          enemyVisual.y
        );

        if (distance <= this.range && distance < closestDistance) {
          closestDistance = distance;
          closestEnemy = child as BaseEnemy;
        }
      }
    });

    return closestEnemy;
  }

  private shoot(target: BaseEnemy) {
    // Create projectile
    const targetVisual = (target as any).visual;
    const projectile = new Projectile(this.sceneRef, this.x, this.y, targetVisual.x, targetVisual.y, target);
    // Add to projectiles group if scene has one
    if ((this.sceneRef as any).projectiles) {
      (this.sceneRef as any).projectiles.add(projectile);
    }
  }

  showRange() {
    if (this.rangeCircle) {
      this.rangeCircle.setPosition(this.x, this.y);
      this.rangeCircle.setVisible(true);
    }
  }

  hideRange() {
    if (this.rangeCircle) {
      this.rangeCircle.setVisible(false);
    }
  }

  getCol(): number {
    return this.col;
  }

  getRow(): number {
    return this.row;
  }

  destroy() {
    if (this.rangeCircle) {
      this.rangeCircle.destroy();
    }
    super.destroy();
  }
}

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
    points.push(
      new Phaser.Geom.Point(
        x + radius * Math.cos(angle),
        y + radius * Math.sin(angle)
      )
    );
  }
  
  return scene.add.polygon(x, y, points, fillColor, fillAlpha);
}
