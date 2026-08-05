import Phaser from "phaser";

/**
 * The health bar drawn above an enemy.
 *
 * Without it the player cannot tell a nearly-dead ogre from a fresh one, which
 * makes every targeting decision guesswork — and targeting is a real lever now
 * that it decides whether a lieutenant lives.
 *
 * Colour shifts green → amber → red with remaining health, so "one more shot"
 * is readable at a glance without reading a number.
 */

const BAR_HEIGHT = 4;
const BORDER = 1;

/** Clearance above the sprite, leaving room for property badges above this. */
const OFFSET_ABOVE_SPRITE = 6;

const COLORS = {
  healthy: 0x4ade80,
  hurt: 0xfacc15,
  critical: 0xef4444,
  backing: 0x000000,
} as const;

export class HealthBar {
  private readonly backing: Phaser.GameObjects.Rectangle;
  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly width: number;

  constructor(scene: Phaser.Scene, width: number) {
    this.width = Math.max(16, Math.round(width));

    this.backing = scene.add
      .rectangle(0, 0, this.width + BORDER * 2, BAR_HEIGHT + BORDER * 2, COLORS.backing, 0.65)
      .setOrigin(0.5, 1)
      // Above enemies, below towers and projectiles, so it never hides a shot.
      .setDepth(540);

    this.fill = scene.add
      .rectangle(0, 0, this.width, BAR_HEIGHT, COLORS.healthy, 1)
      .setOrigin(0, 1)
      .setDepth(541);
  }

  /**
   * Repositions and repaints.
   *
   * @param fraction Remaining health, 0 to 1.
   * @param spriteHeight Used to clear the sprite, whatever its size.
   */
  update(x: number, y: number, spriteHeight: number, fraction: number) {
    const clamped = Math.max(0, Math.min(1, fraction));
    const barY = y - spriteHeight * 0.5 - OFFSET_ABOVE_SPRITE;

    this.backing.setPosition(x, barY);
    // Anchored left so the bar drains toward the left rather than shrinking
    // from both ends, which reads as damage rather than as distance.
    this.fill.setPosition(x - this.width / 2, barY - BORDER);
    this.fill.setSize(Math.max(0, this.width * clamped), BAR_HEIGHT);

    this.fill.setFillStyle(
      clamped > 0.6 ? COLORS.healthy : clamped > 0.3 ? COLORS.hurt : COLORS.critical,
      1,
    );
  }

  /** Vertical space the bar occupies, so badges can stack above it. */
  static reservedHeight(): number {
    return BAR_HEIGHT + BORDER * 2 + OFFSET_ABOVE_SPRITE;
  }

  setVisible(visible: boolean) {
    this.backing.setVisible(visible);
    this.fill.setVisible(visible);
  }

  destroy() {
    this.backing.destroy();
    this.fill.destroy();
  }
}
