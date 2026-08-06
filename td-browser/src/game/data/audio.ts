/**
 * Every sound the game can make, in one manifest.
 *
 * ⚠ THE FILES IN public/audio/ ARE SYNTHESISED PLACEHOLDERS. They are crude on
 * purpose — enough to verify the wiring and to judge pacing, not to ship.
 * Replacing one is a filename change: drop a new `.wav` (or `.ogg`/`.mp3`)
 * over the old one and nothing else moves. Kenney.nl publishes CC0 game audio,
 * which needs no attribution and no licence file in the repo.
 *
 * Two fields matter beyond the filename:
 *
 * - `cooldownMs` stops an audio wall. At wave 15 there are 160 enemies dying
 *   and four towers firing several times a second; playing every one produces
 *   noise rather than feedback, and enough overlapping sources will stutter.
 * - `volume` is set per sound rather than left to the mix, because these are
 *   generated at different amplitudes and a real pack will be too.
 */

import type { EnemyKind, TowerKind } from "../sim/entities";

export type SoundId =
  | "fire-basic"
  | "fire-fast"
  | "fire-long"
  | "fire-mortar"
  | "explosion"
  | "death-slime"
  | "death-bee"
  | "death-ogre"
  | "leak"
  | "place"
  | "upgrade"
  | "sell"
  | "denied"
  | "wave-start"
  | "wave-clear"
  | "power"
  | "lieutenant"
  | "boss"
  | "insignia"
  | "victory"
  | "defeat"
  | "ui-click";

export interface SoundDef {
  /** File in public/audio/, without the extension. */
  file: string;
  volume: number;
  /**
   * Minimum gap between plays of this sound, in milliseconds.
   *
   * Zero means never suppressed — reserve that for things that happen once,
   * like a wave starting.
   */
  cooldownMs: number;
}

export const SOUNDS: Readonly<Record<SoundId, SoundDef>> = Object.freeze({
  // Firing is the most frequent sound by a wide margin, so it is quiet and
  // heavily rate-limited. A tower firing twice a second across eight towers
  // would otherwise be a solid tone.
  "fire-basic": { file: "fire-basic", volume: 0.22, cooldownMs: 90 },
  "fire-fast": { file: "fire-fast", volume: 0.16, cooldownMs: 70 },
  "fire-long": { file: "fire-long", volume: 0.3, cooldownMs: 140 },
  "fire-mortar": { file: "fire-mortar", volume: 0.34, cooldownMs: 160 },

  "explosion": { file: "explosion", volume: 0.4, cooldownMs: 110 },

  // Deaths come in bursts when a splash lands, so they are rate-limited too.
  "death-slime": { file: "death-slime", volume: 0.22, cooldownMs: 80 },
  "death-bee": { file: "death-bee", volume: 0.2, cooldownMs: 80 },
  "death-ogre": { file: "death-ogre", volume: 0.3, cooldownMs: 110 },

  // A leak should cut through: it is the only sound that means "you are
  // losing", and it must be audible over a busy wave.
  "leak": { file: "leak", volume: 0.5, cooldownMs: 200 },

  "place": { file: "place", volume: 0.4, cooldownMs: 0 },
  "upgrade": { file: "upgrade", volume: 0.45, cooldownMs: 0 },
  "sell": { file: "sell", volume: 0.35, cooldownMs: 0 },
  "denied": { file: "denied", volume: 0.3, cooldownMs: 220 },

  "wave-start": { file: "wave-start", volume: 0.45, cooldownMs: 0 },
  "wave-clear": { file: "wave-clear", volume: 0.5, cooldownMs: 0 },
  "power": { file: "power", volume: 0.55, cooldownMs: 0 },
  "lieutenant": { file: "lieutenant", volume: 0.55, cooldownMs: 0 },
  "boss": { file: "boss", volume: 0.7, cooldownMs: 0 },
  "insignia": { file: "insignia", volume: 0.5, cooldownMs: 0 },
  "victory": { file: "victory", volume: 0.6, cooldownMs: 0 },
  "defeat": { file: "defeat", volume: 0.6, cooldownMs: 0 },
  "ui-click": { file: "ui-click", volume: 0.25, cooldownMs: 40 },
});

export const SOUND_IDS = Object.keys(SOUNDS) as SoundId[];

/** Where the files live, relative to the site root. */
export const AUDIO_PATH = "/audio";

/** Extension the placeholders use. A real pack would likely be .ogg. */
export const AUDIO_EXTENSION = "wav";

/**
 * Which death sound an enemy kind makes.
 *
 * Lives here rather than on the AudioManager because it is a mapping, not
 * behaviour — and because AudioManager imports Phaser, which cannot be loaded
 * in the DOM-free test environment.
 */
export function deathSoundFor(kind: EnemyKind): SoundId {
  return kind === "ogre" ? "death-ogre" : kind === "bee" ? "death-bee" : "death-slime";
}

/** Which firing sound a tower kind makes. */
export function fireSoundFor(kind: TowerKind): SoundId {
  return `fire-${kind}` as SoundId;
}
