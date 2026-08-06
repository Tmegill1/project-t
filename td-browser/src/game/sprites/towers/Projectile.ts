import Phaser from "phaser";
import { BaseEnemy } from "../enemies/BaseEnemy";

/** How close counts as a hit, in pixels. */
const HIT_RADIUS = 5;

/** Peak height of a lobbed shot, as a fraction of the distance it travels. */
const ARC_HEIGHT_RATIO = 0.35;

/** Ceiling on that peak, so a cross-map shot does not leave the screen. */
const MAX_ARC_HEIGHT = 90;

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
  /** Multiplies gold from kills this shot makes. */
  goldMultiplier: number;
  /** Flat extra gold per kill. */
  bonusGoldPerKill: number;
  /** Travel speed in pixels per second. */
  speed: number;
  /** Whether the shot lobs rather than flying flat. */
  arcs: boolean;
}

export default class Projectile extends Phaser.GameObjects.Arc {
  private readonly target: BaseEnemy;
  private readonly payload: ProjectilePayload;

  /**
   * Where the shot actually is, as far as the rules are concerned.
   *
   * A lobbed shot is drawn above its logical position, so the two are tracked
   * separately: the arc is presentation, and hit detection must not depend on
   * how high the shell happens to be at that instant.
   */
  private logicalX: number;
  private logicalY: number;
  /** Straight-line distance at launch, for placing the shot along its arc. */
  private readonly launchDistance: number;
  private arcHeight = 0;

  constructor(
    scene: Phaser.Scene,
    startX: number,
    startY: number,
    target: BaseEnemy,
    payload: ProjectilePayload,
  ) {
    // Splash shots are drawn larger, so area damage is legible in play, and
    // lobbed shells larger still — they are meant to read as heavy.
    const radius = payload.arcs ? 7 : payload.splashRadius > 0 ? 6 : 4;
    super(scene, startX, startY, radius, 0, 360, false, payload.color, 1);

    this.target = target;
    // Damage arrives from the firing tower. It used to be a constant here,
    // which is why every tower dealt exactly 3 regardless of its cost.
    this.payload = payload;

    this.logicalX = startX;
    this.logicalY = startY;

    const targetPos = target.getPosition();
    this.launchDistance = Math.max(
      1,
      Math.hypot(targetPos.x - startX, targetPos.y - startY),
    );
    if (payload.arcs) {
      this.arcHeight = Math.min(MAX_ARC_HEIGHT, this.launchDistance * ARC_HEIGHT_RATIO);
      // Drawn above the towers it passes, or a lobbed shell disappears behind
      // them at the top of its arc.
      this.setDepth(760);
    } else {
      this.setDepth(700);
    }

    scene.add.existing(this);
  }

  update(time: number, delta: number) {
    if (!this.target || !this.target.active) {
      this.destroy();
      return;
    }

    const targetPos = this.target.getPosition();
    const dx = targetPos.x - this.logicalX;
    const dy = targetPos.y - this.logicalY;
    const distance = Math.hypot(dx, dy);

    if (distance < HIT_RADIUS) {
      // A dying enemy still occupies the scene while its death animation
      // plays. Damaging it again would pay its reward twice.
      if (!this.target.getIsDying()) {
        this.applyTo(this.target, time);
        if (this.payload.splashRadius > 0) {
          // Centred on the target, not on the sprite: at the moment of impact
          // the two coincide anyway, and this stays correct if the arc changes.
          this.applySplash(targetPos, time);
        }
      }
      this.destroy();
      return;
    }

    const moveDistance = (this.payload.speed * delta) / 1000;
    this.logicalX += (dx / distance) * moveDistance;
    this.logicalY += (dy / distance) * moveDistance;

    this.x = this.logicalX;
    // A parabola peaking halfway: 4t(1-t) is 0 at both ends and 1 at t = 0.5.
    // Subtracted because the screen's y axis points down.
    this.y = this.logicalY - this.arcOffset(distance);
  }

  /** Height above the logical position, for a lobbed shot. */
  private arcOffset(remainingDistance: number): number {
    if (this.arcHeight === 0) return 0;

    const travelled = 1 - Math.min(1, remainingDistance / this.launchDistance);
    return this.arcHeight * 4 * travelled * (1 - travelled);
  }

  private applyTo(enemy: BaseEnemy, time: number) {
    // The firing tower's income upgrades ride along with the shot, so a kill
    // pays according to which tower actually made it.
    enemy.setKillBounty(this.payload.goldMultiplier, this.payload.bonusGoldPerKill);
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
