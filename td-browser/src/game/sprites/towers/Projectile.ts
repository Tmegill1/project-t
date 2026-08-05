import Phaser from "phaser";
import { BaseEnemy } from "../enemies/BaseEnemy";

/** Travel speed in pixels per second. Shared by every tower. */
const PROJECTILE_SPEED = 500;

/** How close counts as a hit, in pixels. */
const HIT_RADIUS = 5;

/** What a shot carries. Assembled by the firing tower from its resolved stats. */
export interface ProjectilePayload {
  damage: number;
  /** Armour points ignored. */
  pierce: number;
  /** Radius of splash damage. Zero means single-target. */
  splashRadius: number;
  /** Speed multiplier applied on hit. 1 means no slow. */
  slowFactor: number;
  slowDurationMs: number;
  /** Tint, so an upgraded tower's shots read as different. */
  color: number;
}

export default class Projectile extends Phaser.GameObjects.Arc {
  private readonly target: BaseEnemy;
  private readonly payload: ProjectilePayload;

  constructor(
    scene: Phaser.Scene,
    startX: number,
    startY: number,
    target: BaseEnemy,
    payload: ProjectilePayload,
  ) {
    // Splash shots are drawn larger, so area damage is legible in play.
    const radius = payload.splashRadius > 0 ? 6 : 4;
    super(scene, startX, startY, radius, 0, 360, false, payload.color, 1);

    this.target = target;
    // Damage arrives from the firing tower. It used to be a constant here,
    // which is why every tower dealt exactly 3 regardless of its cost.
    this.payload = payload;

    scene.add.existing(this);
    this.setDepth(700);
  }

  update(time: number, delta: number) {
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
        this.applyTo(this.target, time);
        if (this.payload.splashRadius > 0) {
          this.applySplash(targetPos, time);
        }
      }
      this.destroy();
      return;
    }

    const moveDistance = (PROJECTILE_SPEED * delta) / 1000;
    this.x += (dx / distance) * moveDistance;
    this.y += (dy / distance) * moveDistance;
  }

  private applyTo(enemy: BaseEnemy, time: number) {
    enemy.takeDamage(this.payload.damage, this.payload.pierce);
    // The slow lands even when a shield swallows the damage — being hit is
    // what chills the target, not being hurt by it.
    enemy.applySlow(this.payload.slowFactor, this.payload.slowDurationMs, time);
  }

  /** Catches everything else within the blast, which is what makes the
   *  sustained branch the answer to splitters. */
  private applySplash(center: { x: number; y: number }, time: number) {
    const scene = this.scene as Phaser.Scene & { enemies?: Phaser.GameObjects.Group };
    const group = scene.enemies;
    if (!group) return;

    for (const child of group.children.entries) {
      if (!(child instanceof BaseEnemy) || child === this.target) continue;
      if (child.getIsDying()) continue;

      const pos = child.getPosition();
      if (Math.hypot(pos.x - center.x, pos.y - center.y) <= this.payload.splashRadius) {
        this.applyTo(child, time);
      }
    }
  }
}
