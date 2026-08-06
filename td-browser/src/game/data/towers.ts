/**
 * Tower statistics.
 *
 * Replaces the `static readonly` constants that lived on each class in
 * src/game/sprites/towers/Towers.ts, and the hardcoded cost/limit tables in
 * TowerManager. Code reads these; there is no logic here.
 */

import type { TowerKind } from "../sim/entities";

/**
 * Frames 5, 6, 12 and 13 are deliberately unused.
 *
 * They are the sheet's remaining four usable sprites — a warm wooden
 * emplacement growing into a broad stone one — and are reserved for the splash
 * tower. Frames 3, 4, 14 and 15 are a scaffold, a foundation slab and two
 * shadow ellipses, not towers.
 */

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
  /**
   * Splash radius before any upgrade, in pixels. Zero for single-target
   * towers — only the Mortar has area damage as its identity rather than as
   * something earned.
   */
  readonly baseSplashRadius: number;
  /** Projectile travel speed in pixels per second. */
  readonly projectileSpeed: number;
  /**
   * Whether shots lob rather than fly flat.
   *
   * Purely how the shot is drawn — it still homes and still hits. A mortar
   * that fired flat bolts read as a slow gun rather than as artillery.
   */
  readonly projectileArcs: boolean;
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
    baseSplashRadius: 0,
    projectileSpeed: 500,
    projectileArcs: false,
    color: 0x0066ff,
    size: 0.8,
    spriteFrame: 8,
    // THE BROAD KEEP. Squat -> crenellated -> arched -> banner-topped.
    // Chosen by silhouette, not by eye: 70px wide at the base growing to 83,
    // so it always reads as the widest, blockiest thing on the board.
    upgradeFrames: [8, 9, 11, 17],
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
    baseSplashRadius: 0,
    projectileSpeed: 500,
    projectileArcs: false,
    color: 0x00ff00,
    size: 0.75,
    spriteFrame: 1,
    // THE SLIM SPIRE. Every frame is 55-66px wide against the keep's 70-83,
    // so the two never converge. The previous series ended on 83px frames,
    // which is exactly why Basic and Fast looked alike once upgraded.
    upgradeFrames: [1, 0, 7, 16],
    baseLimit: 8,
    limitBonusMap2: 2,
  }),
  // The area specialist. Splash is what it *is*, not something it earns, so
  // it answers splitters and packed waves from the moment it is placed — at
  // the cost of the worst single-target damage in the game.
  mortar: Object.freeze({
    label: "Mortar",
    cost: 70,
    costEscalation: 35,
    range: 120,
    fireRate: 2000,
    damage: 5,
    pierce: 0,
    detection: false,
    baseSplashRadius: 55,
    // 20% slower than every other tower, and lobbed. A shell that hangs in
    // the air is what makes the Mortar feel like artillery rather than a
    // slow rifle — and it gives fast enemies a moment to move through the
    // blast before it lands.
    projectileSpeed: 400,
    projectileArcs: true,
    color: 0xb07a3a,
    size: 0.85,
    spriteFrame: 5,
    // Wooden emplacement -> braced -> stone battery -> fortified battery.
    upgradeFrames: [5, 6, 12, 13],
    baseLimit: 5,
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
    baseSplashRadius: 0,
    projectileSpeed: 500,
    projectileArcs: false,
    color: 0xff6600,
    size: 0.85,
    spriteFrame: 2,
    // THE ARTILLERY. The warmest-toned frames in the sheet, and the only
    // series that stops being a tower at all: emplacement -> reinforced ->
    // cannon -> heavy multi-barrel.
    upgradeFrames: [2, 10, 18, 19],
    baseLimit: 5,
    limitBonusMap2: 2,
  }),
});

export function getTowerDef(kind: TowerKind): TowerDef {
  return TOWER_DEFS[kind];
}
