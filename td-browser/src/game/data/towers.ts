/**
 * Tower statistics.
 *
 * Replaces the `static readonly` constants that lived on each class in
 * src/game/sprites/towers/Towers.ts, and the hardcoded cost/limit tables in
 * TowerManager. Code reads these; there is no logic here.
 */

import type { TowerKind } from "../sim/entities";

export interface TowerDef {
  /** Display name, for UI. */
  readonly label: string;
  /** Base purchase price, before per-tower escalation. */
  readonly cost: number;
  /** Added to the price for each tower of this kind already owned. */
  readonly costEscalation: number;
  /** Targeting radius in world pixels. */
  readonly range: number;
  /** Milliseconds between shots. */
  readonly fireRate: number;
  /**
   * Damage per projectile.
   *
   * ⚠ NEEDS TUNING — see NOTES-FOR-HUMAN.md. Damage did not exist as a tower
   * property before this refactor; it was `Projectile.damage = 3`, a constant
   * shared by every tower. All three are set to 3 here so Phase 0 changes no
   * visible behaviour. Differentiating them is a balance decision, and it is
   * the single highest-impact number in the game.
   */
  readonly damage: number;
  /** Fill colour for the fallback polygon and the range indicator. */
  readonly color: number;
  /** Size as a fraction of a tile. */
  readonly size: number;
  /** Frame index in the "towers" sprite sheet. */
  readonly spriteFrame: number;
  /** How many may be built on the first map. */
  readonly baseLimit: number;
  /** Extra allowance on the larger second map. */
  readonly limitBonusMap2: number;
}

export const TOWER_DEFS: Readonly<Record<TowerKind, TowerDef>> = Object.freeze({
  basic: Object.freeze({
    label: "Basic",
    cost: 20,
    costEscalation: 20,
    range: 100,
    fireRate: 1000,
    damage: 3,
    color: 0x0066ff,
    size: 0.8,
    spriteFrame: 0,
    baseLimit: 5,
    limitBonusMap2: 2,
  }),
  fast: Object.freeze({
    label: "Fast",
    cost: 50,
    costEscalation: 30,
    range: 80,
    fireRate: 500,
    damage: 3,
    color: 0x00ff00,
    size: 0.75,
    spriteFrame: 1,
    baseLimit: 5,
    limitBonusMap2: 2,
  }),
  long: Object.freeze({
    label: "Long Range",
    cost: 100,
    costEscalation: 100,
    range: 150,
    fireRate: 1500,
    damage: 3,
    color: 0xff6600,
    size: 0.85,
    spriteFrame: 2,
    baseLimit: 3,
    limitBonusMap2: 2,
  }),
});

export function getTowerDef(kind: TowerKind): TowerDef {
  return TOWER_DEFS[kind];
}
