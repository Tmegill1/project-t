import Phaser from "phaser";
import { tileToWorldCenter } from "../../map/Grid";
import { BaseEnemy } from "../enemies/BaseEnemy";
import Projectile from "./Projectile";

export interface TowerConfig {
  cost: number;
  range: number;
  fireRate: number; // milliseconds between shots
  color: number; // hex color for visual
  size: number; // size multiplier (0.0 to 1.0)
}

export abstract class BaseTower extends Phaser.GameObjects.Container {
  protected config: TowerConfig;
  protected lastFireTime: number = 0;
  protected currentTarget: BaseEnemy | null = null;
  protected rangeCircle?: Phaser.GameObjects.Arc;
  protected sceneRef: Phaser.Scene;
  protected col: number;
  protected row: number;

  constructor(
    scene: Phaser.Scene,
    col: number,
    row: number,
    config: TowerConfig,
    visual: Phaser.GameObjects.GameObject
  ) {
    // Calculate world position before calling super (can't use 'this' before super)
    const worldPos = tileToWorldCenter(col, row);
    super(scene, worldPos.x, worldPos.y, [visual]);
    
    this.sceneRef = scene;
    this.col = col;
    this.row = row;
    this.config = config;
    
    scene.add.existing(this);
    this.setDepth(600); // Above enemies
    
    // Create range circle (hidden by default)
    this.rangeCircle = scene.add.circle(worldPos.x, worldPos.y, config.range, config.color, 0.2);
    if (this.rangeCircle) {
      this.rangeCircle.setStrokeStyle(2, config.color, 0.5);
      this.rangeCircle.setDepth(550);
      this.rangeCircle.setVisible(false);
    }
  }

  update(time: number, _delta: number, enemies: Phaser.GameObjects.Group) {
    // Update range circle position
    if (this.rangeCircle) {
      this.rangeCircle.setPosition(this.x, this.y);
    }

    // Find target if we don't have one or current target is out of range/destroyed
    if (!this.currentTarget || !this.isTargetValid(this.currentTarget, enemies)) {
      this.currentTarget = this.findTarget(enemies);
    }

    // Shoot at target if we have one and enough time has passed
    if (this.currentTarget && time - this.lastFireTime >= this.config.fireRate) {
      this.shoot(this.currentTarget);
      this.lastFireTime = time;
    }
  }

  protected isTargetValid(target: BaseEnemy, enemies: Phaser.GameObjects.Group): boolean {
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
    
    return distance <= this.config.range;
  }

  protected findTarget(enemies: Phaser.GameObjects.Group): BaseEnemy | null {
    let closestEnemy: BaseEnemy | null = null;
    let closestDistance = this.config.range;

    enemies.children.entries.forEach((child) => {
      if (child instanceof BaseEnemy) {
        const enemyVisual = (child as any).visual;
        const distance = Phaser.Math.Distance.Between(
          this.x,
          this.y,
          enemyVisual.x,
          enemyVisual.y
        );

        if (distance <= this.config.range && distance < closestDistance) {
          closestDistance = distance;
          closestEnemy = child as BaseEnemy;
        }
      }
    });

    return closestEnemy;
  }

  protected shoot(target: BaseEnemy) {
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

  getCost(): number {
    return this.config.cost;
  }

  destroy() {
    if (this.rangeCircle) {
      this.rangeCircle.destroy();
    }
    super.destroy();
  }
}
