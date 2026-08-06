/**
 * Upgrade rules: what may be bought, what it costs, and what a tower becomes.
 *
 * The cross-path rule is the whole point. A tower may take one branch to tier 4
 * only if the other stays at tier 2 or below, so every tower is a commitment
 * rather than a checklist. Without it, gold is the only constraint and every
 * tower converges on the same fully-upgraded shape.
 */

import { UPGRADE_DEFS } from "../data/upgrades";
import { getTowerDef } from "../data/towers";
import type { UpgradeBranch } from "../data/upgrades";
import type { TowerKind } from "./entities";

export type { UpgradeBranch };

/** Highest tier any branch can reach. */
export const MAX_TIER = 4;

/**
 * Highest tier the *other* branch may sit at while one branch goes deep.
 *
 * Reaching tier 3 requires the other branch to be at or below this.
 */
export const CROSS_PATH_CAP = 2;

/** Tiers bought on each branch, 0 to MAX_TIER. */
export interface UpgradeTiers {
  sustained: number;
  burst: number;
}

export function emptyTiers(): UpgradeTiers {
  return { sustained: 0, burst: 0 };
}

function otherBranch(branch: UpgradeBranch): UpgradeBranch {
  return branch === "sustained" ? "burst" : "sustained";
}

/** Whether the next tier on a branch may be bought. Ignores affordability. */
export function canUpgrade(tiers: UpgradeTiers, branch: UpgradeBranch): boolean {
  const next = tiers[branch] + 1;
  if (next > MAX_TIER) return false;
  // Going past the cap commits this tower; the other branch must already be
  // shallow, and stays locked there afterwards.
  if (next > CROSS_PATH_CAP && tiers[otherBranch(branch)] > CROSS_PATH_CAP) return false;
  return true;
}

/** Buys the next tier. Throws rather than silently ignoring an illegal buy —
 *  a call that should have been gated is a bug, not a no-op. */
export function withUpgrade(tiers: UpgradeTiers, branch: UpgradeBranch): UpgradeTiers {
  if (!canUpgrade(tiers, branch)) {
    throw new Error(
      `Illegal upgrade: ${branch} from tier ${tiers[branch]} ` +
        `with ${otherBranch(branch)} at tier ${tiers[otherBranch(branch)]}`,
    );
  }
  return { ...tiers, [branch]: tiers[branch] + 1 };
}

/** Price of moving a branch from `currentTier` to the next. Zero when maxed. */
export function upgradeCost(
  kind: TowerKind,
  branch: UpgradeBranch,
  currentTier: number,
): number {
  if (currentTier >= MAX_TIER || currentTier < 0) return 0;
  return UPGRADE_DEFS[kind][branch].tiers[currentTier].cost;
}

/** Total gold sunk into a tower's upgrades, for sell-value calculations. */
export function totalInvested(kind: TowerKind, tiers: UpgradeTiers): number {
  let total = 0;
  for (const branch of ["sustained", "burst"] as const) {
    for (let tier = 0; tier < tiers[branch]; tier++) {
      total += upgradeCost(kind, branch, tier);
    }
  }
  return total;
}

/**
 * How many distinct looks a tower has, from unupgraded to fully committed.
 *
 * Four, not seven. A tower can hold six tiers in total, but a player cannot
 * read six silhouettes apart at tile size — and the useful signal is "how much
 * is invested here", not the exact tier.
 */
export const VISUAL_TIERS = 4;

/**
 * Which of a tower's sprite frames to draw, from its purchased tiers.
 *
 * Driven by total investment across both branches, so a tower taken deep down
 * one path and one taken evenly both look like what they are: expensive.
 */
export function visualTier(tiers: UpgradeTiers): number {
  const total = Math.max(0, tiers.sustained) + Math.max(0, tiers.burst);
  // 0 tiers -> 0, 1-2 -> 1, 3-4 -> 2, 5-6 -> 3.
  return Math.min(VISUAL_TIERS - 1, Math.ceil(total / 2));
}

/** The sprite frame a tower should be showing. */
export function spriteFrameFor(kind: TowerKind, tiers: UpgradeTiers): number {
  const frames = getTowerDef(kind).upgradeFrames;
  const tier = Math.min(visualTier(tiers), frames.length - 1);
  return frames[tier];
}

/** A tower's live combat stats after upgrades. */
export interface ResolvedTowerStats {
  damage: number;
  /** Milliseconds between shots. */
  fireRate: number;
  range: number;
  /** Armour points ignored per hit. */
  pierce: number;
  /** Splash radius in pixels. Zero means single-target. */
  splashRadius: number;
  /** Can target phased enemies. */
  detection: boolean;
  /** Speed multiplier applied to enemies hit. 1 means no slow. */
  slowFactor: number;
  slowDurationMs: number;
  /** Multiplies gold from kills this tower makes. */
  goldMultiplier: number;
  /** Flat extra gold per kill. */
  bonusGoldPerKill: number;
}

/**
 * Applies every purchased tier to a tower's base stats.
 *
 * Multipliers compose, flat bonuses add, radii and slows take the strongest
 * value rather than stacking — otherwise tier 4's big splash would be added to
 * tier 2's small one and the numbers would drift from what the tier text says.
 */
export function resolveTowerStats(kind: TowerKind, tiers: UpgradeTiers): ResolvedTowerStats {
  const base = getTowerDef(kind);

  const stats: ResolvedTowerStats = {
    damage: base.damage,
    fireRate: base.fireRate,
    range: base.range,
    pierce: base.pierce,
    splashRadius: base.baseSplashRadius,
    detection: base.detection,
    slowFactor: 1,
    slowDurationMs: 0,
    goldMultiplier: 1,
    bonusGoldPerKill: 0,
  };

  for (const branch of ["sustained", "burst"] as const) {
    const definition = UPGRADE_DEFS[kind][branch];
    for (let tier = 0; tier < tiers[branch]; tier++) {
      const { effects } = definition.tiers[tier];

      if (effects.damageMultiplier) stats.damage *= effects.damageMultiplier;
      if (effects.fireRateMultiplier) stats.fireRate *= effects.fireRateMultiplier;
      if (effects.rangeMultiplier) stats.range *= effects.rangeMultiplier;
      if (effects.pierceBonus) stats.pierce += effects.pierceBonus;
      if (effects.splashRadius) {
        stats.splashRadius = Math.max(stats.splashRadius, effects.splashRadius);
      }
      if (effects.detection) stats.detection = true;
      if (effects.goldMultiplier) {
        stats.goldMultiplier = Math.max(stats.goldMultiplier, effects.goldMultiplier);
      }
      if (effects.bonusGoldPerKill) {
        stats.bonusGoldPerKill = Math.max(stats.bonusGoldPerKill, effects.bonusGoldPerKill);
      }
      if (effects.slowFactor !== undefined && effects.slowFactor < stats.slowFactor) {
        stats.slowFactor = effects.slowFactor;
        stats.slowDurationMs = effects.slowDurationMs ?? stats.slowDurationMs;
      }
    }
  }

  // Damage is per-hit and integral; rounding here keeps the number the player
  // sees and the number the simulation applies identical.
  stats.damage = Math.round(stats.damage);
  stats.fireRate = Math.round(stats.fireRate);
  stats.range = Math.round(stats.range);

  return stats;
}
