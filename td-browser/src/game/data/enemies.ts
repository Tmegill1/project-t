/**
 * Enemy statistics.
 *
 * Replaces the local constants declared inside each constructor in
 * src/game/sprites/enemies/Enemy.ts (`const baseSpeed = 100`, and so on).
 */

import type { EnemyKind } from "../sim/entities";

export interface EnemyDef {
  readonly label: string;
  /** Pixels per second before the wave speed modifier. */
  readonly baseSpeed: number;
  /** Health before the wave health modifier. */
  readonly baseHealth: number;
  /** Gold paid out on kill. */
  readonly reward: number;
  /** Lives lost on leak, at or below the life-loss scaling wave. */
  readonly lifeLoss: number;
  /**
   * Prefix for this creature's sprite sheets. BootScene registers them as
   * `${textureKey}-walk-down`, `${textureKey}-death-side`, and so on.
   */
  readonly textureKey: string;
  /** Sprite size as a fraction of a tile. */
  readonly spriteScale: number;
  /** Whether the artwork faces the wrong way and needs a permanent flip. */
  readonly flipHorizontally: boolean;
}

export const ENEMY_DEFS: Readonly<Record<EnemyKind, EnemyDef>> = Object.freeze({
  slime: Object.freeze({
    label: "Slime",
    baseSpeed: 100,
    baseHealth: 5,
    reward: 5,
    lifeLoss: 1,
    textureKey: "slime",
    spriteScale: 0.7,
    flipHorizontally: false,
  }),
  ogre: Object.freeze({
    label: "Ogre",
    baseSpeed: 60,
    baseHealth: 8,
    reward: 20,
    lifeLoss: 5,
    textureKey: "ogre",
    // Larger than the others: the original used 1.2 tiles rather than 0.7.
    spriteScale: 1.2,
    flipHorizontally: true,
  }),
  bee: Object.freeze({
    label: "Bee",
    baseSpeed: 150,
    baseHealth: 3,
    reward: 10,
    lifeLoss: 2,
    textureKey: "bee",
    spriteScale: 0.7,
    flipHorizontally: false,
  }),
});

export function getEnemyDef(kind: EnemyKind): EnemyDef {
  return ENEMY_DEFS[kind];
}

/** Health for a spawn, applying the wave modifier. Floors, as the original
 *  constructors did, and never returns less than one. */
export function scaledHealth(kind: EnemyKind, healthModifier: number): number {
  return Math.max(1, Math.floor(ENEMY_DEFS[kind].baseHealth * healthModifier));
}

/** Speed for a spawn, applying the wave modifier. Unrounded, as the original
 *  constructors were. */
export function scaledSpeed(kind: EnemyKind, speedModifier: number): number {
  return Math.max(1, ENEMY_DEFS[kind].baseSpeed * speedModifier);
}
