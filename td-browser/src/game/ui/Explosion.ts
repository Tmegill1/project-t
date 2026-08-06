import Phaser from "phaser";
import { audio } from "../audio/AudioManager";

/**
 * The burst drawn where a splash shot lands.
 *
 * Sized to the shot's actual blast radius rather than a fixed sprite, so what
 * the player sees is what the simulation used. An explosion that looked the
 * same at 55px and 130px would make upgrading the Mortar's Saturation branch
 * feel like it did nothing.
 *
 * Self-destroying: it tweens out and removes itself, so callers fire and
 * forget. Nothing holds a reference, and nothing needs cleaning up on scene
 * shutdown.
 */

/** How long the burst takes to play out. */
const DURATION_MS = 260;

/** Fraction of the blast radius the flash starts at. */
const START_SCALE = 0.35;

export function spawnExplosion(
  scene: Phaser.Scene,
  x: number,
  y: number,
  radius: number,
  color: number,
): void {
  if (radius <= 0) return;

  audio.play(scene, "explosion");

  // The shockwave: a ring that expands to exactly the blast radius, so the
  // player can see how much ground the shot actually covered.
  const ring = scene.add
    .circle(x, y, radius, color, 0)
    .setStrokeStyle(3, color, 0.9)
    .setScale(START_SCALE)
    .setDepth(770);

  scene.tweens.add({
    targets: ring,
    scale: 1,
    alpha: 0,
    duration: DURATION_MS,
    ease: "Quad.easeOut",
    onComplete: () => ring.destroy(),
  });

  // The flash: a brighter core that fades faster, so the centre reads as the
  // impact point rather than the whole area going up evenly.
  const flash = scene.add
    .circle(x, y, radius * 0.55, 0xffe9a8, 0.85)
    .setScale(START_SCALE)
    .setDepth(771);

  scene.tweens.add({
    targets: flash,
    scale: 0.9,
    alpha: 0,
    duration: DURATION_MS * 0.6,
    ease: "Cubic.easeOut",
    onComplete: () => flash.destroy(),
  });
}
