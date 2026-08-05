/**
 * Tower upgrade tiers.
 *
 * Two branches per tower, four tiers each, and a cross-path rule that lets only
 * one branch go past tier 2. The branches answer different problems:
 *
 *   sustained  rate of fire, splash, slowing   -> clears waves, breaks shields
 *   burst      damage per hit, pierce          -> kills elites, breaks armour
 *
 * The scarce counters are deliberately spread across *towers*, not just
 * branches, so no single tower answers everything even when fully committed:
 *
 *   detection  BasicTower only    -> phased enemies force a basic-tower buy
 *   slowing    FastTower only     -> swift enemies force a fast-tower buy
 *   heavy pierce  LongRangeTower  -> armoured enemies force a long-range buy
 *
 * Every one of those sits at **tier 3 or above**, which matters: the cross-path
 * rule hands each tower two free tiers of its off-branch, so a counter placed
 * at tier 1 or 2 would be given to every build for nothing. Counters must cost
 * a commitment, or there is no decision.
 *
 * Combined with the per-type tower caps, that is what stops one build from
 * covering all five enemy properties.
 *
 * ⚠ Every number here is a placeholder needing playtesting.
 * See NOTES-FOR-HUMAN.md.
 */

import type { TowerKind } from "../sim/entities";

export type UpgradeBranch = "sustained" | "burst";

export const UPGRADE_BRANCHES = ["sustained", "burst"] as const satisfies readonly UpgradeBranch[];

/** What a tier does. Multipliers compose; flat values add; flags OR together. */
export interface UpgradeEffects {
  /** Multiplies damage per hit. */
  damageMultiplier?: number;
  /** Multiplies the gap between shots. Below 1 means faster. */
  fireRateMultiplier?: number;
  rangeMultiplier?: number;
  /** Armour points ignored, added to any already present. */
  pierceBonus?: number;
  /** Radius of splash damage in world pixels. The largest tier wins. */
  splashRadius?: number;
  /** Lets the tower see phased enemies. */
  detection?: boolean;
  /** Speed multiplier applied to enemies hit. The strongest tier wins. */
  slowFactor?: number;
  /** How long a slow lasts. */
  slowDurationMs?: number;
  /** Multiplies gold from kills this tower makes. The largest tier wins. */
  goldMultiplier?: number;
  /** Flat bonus gold per kill, on top of the reward. */
  bonusGoldPerKill?: number;
}

export interface UpgradeTier {
  label: string;
  /** Shown to the player. The UI must communicate what a branch does. */
  description: string;
  cost: number;
  effects: UpgradeEffects;
}

export interface BranchDef {
  label: string;
  /** One line on what committing to this branch buys you. */
  summary: string;
  /** Exactly four, tiers 1 through 4. */
  tiers: readonly UpgradeTier[];
}

export type TowerUpgradeDef = Readonly<Record<UpgradeBranch, BranchDef>>;

export const UPGRADE_DEFS: Readonly<Record<TowerKind, TowerUpgradeDef>> = Object.freeze({
  // Generalist. The only source of detection, which is what makes phased
  // enemies a real problem rather than a nuisance.
  basic: Object.freeze({
    sustained: {
      label: "Barrage",
      summary: "Faster fire, then splash damage. Clears crowds and splitters.",
      tiers: [
        {
          label: "Quick Loader",
          description: "Fires 20% faster.",
          cost: 30,
          effects: { fireRateMultiplier: 0.8 },
        },
        {
          label: "Drum Feed",
          description: "Fires 20% faster again.",
          cost: 60,
          effects: { fireRateMultiplier: 0.8 },
        },
        {
          label: "Fragmentation",
          description: "Shots splash for 45px.",
          cost: 130,
          effects: { splashRadius: 45, fireRateMultiplier: 0.9 },
        },
        {
          label: "Saturation",
          description: "Splash grows to 75px and damage rises by half.",
          cost: 260,
          effects: { splashRadius: 75, damageMultiplier: 1.5 },
        },
      ],
    },
    burst: {
      label: "Marksman",
      summary: "Heavier hits, then detection. The only way to see phased enemies.",
      tiers: [
        {
          label: "Heavy Rounds",
          description: "Damage up by 40%.",
          cost: 30,
          effects: { damageMultiplier: 1.4 },
        },
        {
          label: "Rifled Barrel",
          description: "Damage up by 40% again.",
          cost: 65,
          effects: { damageMultiplier: 1.4 },
        },
        {
          label: "Spotter",
          description: "Reveals and targets phased enemies. Damage up by half.",
          cost: 145,
          effects: { detection: true, damageMultiplier: 1.5 },
        },
        {
          label: "Executioner",
          description: "Damage doubles and range extends by a quarter.",
          cost: 290,
          effects: { damageMultiplier: 2, rangeMultiplier: 1.25 },
        },
      ],
    },
  }),

  // Anti-shield specialist, and the only source of slowing.
  fast: Object.freeze({
    sustained: {
      label: "Suppression",
      summary: "Blistering cadence, then slowing. Answers shields and swiftness.",
      tiers: [
        {
          label: "Hair Trigger",
          description: "Fires 25% faster.",
          cost: 40,
          effects: { fireRateMultiplier: 0.75 },
        },
        {
          label: "Overclocked",
          description: "Fires 25% faster again.",
          cost: 80,
          effects: { fireRateMultiplier: 0.75 },
        },
        {
          label: "Cryo Rounds",
          description: "Hits slow enemies to 70% speed for 1.5s.",
          cost: 165,
          effects: { slowFactor: 0.7, slowDurationMs: 1500 },
        },
        {
          label: "Deep Freeze",
          description: "Slows to 45% speed for 2.5s and fires 20% faster.",
          cost: 330,
          effects: { slowFactor: 0.45, slowDurationMs: 2500, fireRateMultiplier: 0.8 },
        },
      ],
    },
    // The income branch. A fast tower farms a great many small kills, so gold
    // per kill is the multiplier that suits it — and it gives the player a
    // reason to build economy rather than only defence.
    burst: {
      label: "Bounty Hunter",
      summary: "Turns volume of kills into gold. The economy branch.",
      tiers: [
        {
          label: "Machined Rounds",
          description: "Damage up by half.",
          cost: 40,
          effects: { damageMultiplier: 1.5 },
        },
        {
          label: "Scavenger",
          description: "Kills pay 1 extra gold.",
          cost: 85,
          effects: { bonusGoldPerKill: 1 },
        },
        {
          label: "Bounty Board",
          description: "Kills pay 60% more gold, and damage rises by 40%.",
          cost: 175,
          effects: { goldMultiplier: 1.6, damageMultiplier: 1.4 },
        },
        {
          label: "War Profiteer",
          description: "Kills pay double gold, plus 2 extra each.",
          cost: 350,
          effects: { goldMultiplier: 2, bonusGoldPerKill: 2 },
        },
      ],
    },
  }),

  // Anti-armour specialist. The heaviest pierce in the game.
  long: Object.freeze({
    sustained: {
      label: "Bombardment",
      summary: "Reach and cadence, then splash. Covers ground nothing else can.",
      tiers: [
        {
          label: "Long Barrel",
          description: "Range up by 20%.",
          cost: 60,
          effects: { rangeMultiplier: 1.2 },
        },
        {
          label: "Rapid Loader",
          description: "Fires 30% faster.",
          cost: 120,
          effects: { fireRateMultiplier: 0.7 },
        },
        {
          label: "Shellburst",
          description: "Shots splash for 55px.",
          cost: 240,
          effects: { splashRadius: 55 },
        },
        {
          label: "Carpet Fire",
          description: "Splash grows to 90px and range extends by a third.",
          cost: 450,
          effects: { splashRadius: 90, rangeMultiplier: 1.33 },
        },
      ],
    },
    burst: {
      label: "Siege",
      summary: "The armour answer. Enormous hits that ignore plating entirely.",
      tiers: [
        {
          label: "Dense Slug",
          description: "Damage up by 40%.",
          cost: 60,
          effects: { damageMultiplier: 1.4 },
        },
        {
          label: "Shaped Charge",
          description: "Damage up by 40% again.",
          cost: 130,
          effects: { damageMultiplier: 1.4 },
        },
        {
          label: "Tungsten Core",
          description: "Ignores 5 armour.",
          cost: 260,
          effects: { pierceBonus: 5 },
        },
        {
          label: "Siege Cannon",
          description: "Damage doubles and ignores 10 more armour.",
          cost: 500,
          effects: { damageMultiplier: 2, pierceBonus: 10 },
        },
      ],
    },
  }),
});
