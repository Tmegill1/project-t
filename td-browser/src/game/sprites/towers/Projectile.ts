import Phaser from "phaser";
import { BaseEnemy } from "../enemies/BaseEnemy";

/** Travel speed in pixels per second. Shared by every tower. */
const PROJECTILE_SPEED = 500;

/** How close counts as a hit, in pixels. */
const HIT_RADIUS = 5;

export default class Projectile extends Phaser.GameObjects.Arc {
  private readonly target: BaseEnemy;
  private readonly damage: number;

  constructor(
    scene: Phaser.Scene,
    startX: number,
    startY: number,
    target: BaseEnemy,
    damage: number,
  ) {
    super(scene, startX, startY, 4, 0, 360, false, 0xffff00, 1);

    this.target = target;
    // Damage arrives from the firing tower. It used to be a constant here,
    // which is why every tower dealt exactly 3 regardless of its cost.
    this.damage = damage;

    scene.add.existing(this);
    this.setDepth(700);
  }

  update(_time: number, delta: number) {
    if (!this.target || !this.target.active) {
      this.destroy();
      return;
    }

    const targetPos = this.target.getPosition();
    const dx = targetPos.x - this.x;
    const dy = targetPos.y - this.y;
    const distance = Math.hypot(dx, dy);

    if (distance < HIT_RADIUS) {
      // A dying enemy still occupies the scene while its death animation
      // plays. Damaging it again would pay its reward twice.
      if (!this.target.getIsDying()) {
        this.target.takeDamage(this.damage);
      }
      this.destroy();
      return;
    }

    const moveDistance = (PROJECTILE_SPEED * delta) / 1000;
    this.x += (dx / distance) * moveDistance;
    this.y += (dy / distance) * moveDistance;
  }
}
