import Phaser from "phaser";
import { describeProperties } from "../sim/properties";
import type { EnemyProperty } from "../sim/properties";

/**
 * The marks drawn on an enemy that carries properties.
 *
 * A property the player cannot see is a difficulty spike, not a decision — they
 * lose the wave and learn nothing about why. Each property gets a distinct glyph
 * and colour drawn above the sprite, and `legendFor` supplies the same
 * information as text for the wave banner.
 */

const GLYPHS: Readonly<Record<EnemyProperty, { glyph: string; color: string }>> = Object.freeze({
  armored: { glyph: "▣", color: "#b8c4d8" },
  shielded: { glyph: "◈", color: "#63c8ff" },
  swift: { glyph: "»", color: "#ffe27a" },
  phased: { glyph: "◌", color: "#c98bff" },
  splitter: { glyph: "⧉", color: "#7fe08a" },
});

export class EnemyBadges {
  private readonly text?: Phaser.GameObjects.Text;

  // A plain parameter, not a parameter property: tsconfig sets
  // `erasableSyntaxOnly`, which bans the shorthand.
  constructor(scene: Phaser.Scene, properties: readonly EnemyProperty[]) {
    if (properties.length === 0) return;

    this.text = scene.add
      .text(0, 0, properties.map((p) => GLYPHS[p].glyph).join(""), {
        fontSize: "14px",
        // A single colour for the row keeps it readable at sprite size; the
        // panel and legend carry the per-property detail.
        color: GLYPHS[properties[0]].color,
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(560);
  }

  /** Keeps the badges pinned above the sprite. */
  update(x: number, y: number, spriteHeight: number) {
    this.text?.setPosition(x, y - spriteHeight * 0.5 - 2);
  }

  setVisible(visible: boolean) {
    this.text?.setVisible(visible);
  }

  destroy() {
    this.text?.destroy();
  }

  hasBadges(): boolean {
    return this.text !== undefined;
  }

  /** Same information as readable text, for a wave-start banner. */
  static legendFor(properties: readonly EnemyProperty[]): string {
    return describeProperties(properties)
      .map((d) => `${GLYPHS[d.property].glyph} ${d.label}: ${d.effect}. Counter: ${d.counter}.`)
      .join("\n");
  }

  static glyphFor(property: EnemyProperty): string {
    return GLYPHS[property].glyph;
  }
}
