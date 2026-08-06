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
  /**
   * Added to the price for each tower of this kind already owned.
   *
   * Halved from the original. Escalation exists to stop the board becoming
   * twenty copies of one tower, and it still does — but at the old rate a
   * player was sitting on hundreds of unspent gold from wave 8 with nothing
   * to buy, which turns winning into waiting.
   */
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
  /** Frame index in the "towers" sprite sheet, unupgraded. */
  readonly spriteFrame: number;
  /**
   * Sprite frames by visual tier, from unupgraded to fully committed.
   *
   * A tower that has had gold poured into it should look like it. Each series
   * is chosen to read as the same structure growing rather than as four
   * unrelated buildings, and each ends somewhere distinctive: the generalist
   * becomes a banner-topped keep, the rapid tower a tall windowed spire, and
   * the long-range tower an actual artillery piece.
   */
  readonly upgradeFrames: readonly number[];
  /**
   * How many may be built on the first map.
   *
   * Raised. The caps were the *original* progression gate, written before
   * upgrades, powers or meta-progression existed — all of which now do that
   * job. Measured against a full run, the old 5/5/3 pinned the board at
   * thirteen towers from wave 8 while gold climbed past two thousand unspent.
   * Kept rather than removed, because something has to stop a board of twenty
   * identical towers.
   */
  readonly baseLimit: number;
  /** Extra allowance on the larger second map. */
  readonly limitBonusMap2: number;
}

export const TOWER_DEFS: Readonly<Record<TowerKind, TowerDef>> = Object.freeze({
  basic: Object.freeze({
    label: "Basic",
    cost: 20,
    costEscalation: 10,
    range: 100,
    fireRate: 1000,
    damage: 4,
    pierce: 0,
    detection: false,
    color: 0x0066ff,
    size: 0.8,
    spriteFrame: 8,
    // Squat keep -> taller -> windowed -> banner-topped grand keep.
    // Frame 8 is the smaller of the two plain keeps, so the series grows
    // rather than shrinking on the first upgrade.
    upgradeFrames: [8, 0, 16, 17],
    baseLimit: 8,
    limitBonusMap2: 2,
  }),
  fast: Object.freeze({
    label: "Fast",
    cost: 50,
    costEscalation: 15,
    range: 80,
    fireRate: 500,
    damage: 2,
    pierce: 0,
    detection: false,
    color: 0x00ff00,
    size: 0.75,
    spriteFrame: 1,
    // Slim ribbed tower -> taller -> windowed spire -> tallest.
    upgradeFrames: [1, 7, 12, 13],
    baseLimit: 8,
    limitBonusMap2: 2,
  }),
  long: Object.freeze({
    label: "Long Range",
    cost: 100,
    costEscalation: 50,
    range: 150,
    fireRate: 1500,
    damage: 15,
    pierce: 0,
    detection: false,
    color: 0xff6600,
    size: 0.85,
    spriteFrame: 2,
    // Wide mortar emplacement -> reinforced -> cannon -> heavy multi-barrel.
    upgradeFrames: [2, 10, 18, 19],
    baseLimit: 5,
    limitBonusMap2: 2,
  }),
});

export function getTowerDef(kind: TowerKind): TowerDef {
  return TOWER_DEFS[kind];
}
