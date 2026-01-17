import Phaser from "phaser";
import { BaseEnemy } from "../enemies/BaseEnemy";

export default class Projectile extends Phaser.GameObjects.Arc {
  private target: BaseEnemy;
  private speed: number = 500; // pixels per second
  private damage: number = 3;

  constructor(
    scene: Phaser.Scene,
    startX: number,
    startY: number,
    _targetX: number,
    _targetY: number,
    target: BaseEnemy
  ) {
    // Create small projectile (yellow circle)
    super(scene, startX, startY, 4, 0, 360, false, 0xffff00, 1);
    
    this.target = target;
    
    scene.add.existing(this);
    this.setDepth(700); // Above everything
  }

  update(_time: number, delta: number) {
    // Check if target still exists
    const targetVisual = (this.target as any).visual;
    if (!targetVisual || !targetVisual.active || !this.target) {
      this.destroy();
      return;
    }

    // Get current target position (target may be moving)
    const targetX = targetVisual.x;
    const targetY = targetVisual.y;
    
    // Move towards target
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 5) {
      // Hit target - but only deal damage if enemy is not dying
      if (!this.target.getIsDying()) {
        this.target.takeDamage(this.damage);
      }
      // Destroy projectile regardless (even if enemy is dying, projectile disappears)
      this.destroy();
      return;
    }

    // Move towards target
    const moveDistance = (this.speed * delta) / 1000;
    const moveX = (dx / distance) * moveDistance;
    const moveY = (dy / distance) * moveDistance;
    
    this.x += moveX;
    this.y += moveY;
  }
}
