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
   * ⚠ NEEDS TUNING — see NOTES-FOR-HUMAN.md.
   *
   * These are no longer identical. Phase 1 assigns each tower a role —
   * generalist, anti-shield, anti-armour — and those roles are expressed
   * almost entirely through the damage/cadence shape:
   *
   *   fast   low damage, high cadence  -> strips shields, useless vs armour
   *   long   high damage, low cadence  -> punches armour, wastes hits on shields
   *   basic  middling both             -> adequate everywhere, best nowhere
   *
   * Phase 0 kept all three at 3, which made FastTower strictly dominant and
   * LongRangeTower unbuildable. Differentiating them is what gives enemy
   * properties something to punish.
   */
  readonly damage: number;
  /**
   * Armour points ignored per hit. Answers armour only, never shields.
   * Zero on every base tower — pierce is earned through the burst branch.
   */
  readonly pierce: number;
  /** Whether this tower can target phased enemies without an upgrade. */
  readonly detection: boolean;
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
    damage: 4,
    pierce: 0,
    detection: false,
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
    damage: 2,
    pierce: 0,
    detection: false,
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
    damage: 15,
    pierce: 0,
    detection: false,
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
