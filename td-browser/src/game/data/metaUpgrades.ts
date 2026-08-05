/**
 * What Seals buy between runs.
 *
 * Three kinds, and the difference matters:
 *
 * - **Tower unlocks** widen what the player may build. They add options, not
 *   power — an unlocked tower still costs gold and still has to earn its place.
 * - **Power unlocks** put a tactical power or command upgrade into the pool
 *   that Insignia can buy during a run. Again: options, not power.
 * - **Passives** are the only thing that makes the player numerically stronger,
 *   and they are **hard-capped**.
 *
 * ★ The cap is the load-bearing rule of the whole phase. If meta upgrades beat
 * the game, skill stops mattering and a new player is simply told to grind.
 * `META_PASSIVE_CEILING` is enforced in code, not merely respected by the data
 * — see sim/metaProgression.ts.
 *
 * ⚠ Every number here is a placeholder needing playtesting.
 * See NOTES-FOR-HUMAN.md.
 */

import type { CommandUpgradeId, TacticalPowerId } from "./powers";
import type { TowerKind } from "../sim/entities";

/**
 * The hard ceiling on any permanent passive, as a fraction.
 *
 * 0.10 is the top of the 5–10% band the design specifies. Nothing may exceed
 * it, whatever the data says.
 */
export const META_PASSIVE_CEILING = 0.1;

export type MetaPassiveId =
  | "veteranCrews"
  | "warChest"
  | "reinforcedCore"
  | "quartermaster";

export const META_PASSIVE_IDS = [
  "veteranCrews",
  "warChest",
  "reinforcedCore",
  "quartermaster",
] as const satisfies readonly MetaPassiveId[];

export interface MetaPassiveDef {
  label: string;
  description: string;
  /** What each tier adds, as a fraction. Total is clamped by the ceiling. */
  perTier: number;
  maxTier: number;
  /** Seals for the first tier; each subsequent tier costs this much more. */
  baseCost: number;
  costPerTier: number;
}

export const META_PASSIVES: Readonly<Record<MetaPassiveId, MetaPassiveDef>> = Object.freeze({
  veteranCrews: {
    label: "Veteran Crews",
    description: "Towers deal slightly more damage.",
    perTier: 0.025,
    maxTier: 4,
    baseCost: 12,
    costPerTier: 8,
  },
  warChest: {
    label: "War Chest",
    description: "Start each run with more gold.",
    perTier: 0.025,
    maxTier: 4,
    baseCost: 10,
    costPerTier: 6,
  },
  reinforcedCore: {
    label: "Reinforced Core",
    description: "Start each run with more lives.",
    perTier: 0.025,
    maxTier: 4,
    baseCost: 14,
    costPerTier: 10,
  },
  quartermaster: {
    label: "Quartermaster",
    description: "Kills pay slightly more gold.",
    perTier: 0.025,
    maxTier: 4,
    baseCost: 12,
    costPerTier: 8,
  },
});

export interface TowerUnlockDef {
  tower: TowerKind;
  label: string;
  description: string;
  cost: number;
}

/** BasicTower is not listed: a run must always have something to build. */
export const TOWER_UNLOCKS: readonly TowerUnlockDef[] = Object.freeze([
  {
    tower: "fast",
    label: "Fast Tower",
    description: "Rapid, cheap fire. The answer to shields, and the economy tower.",
    cost: 15,
  },
  {
    tower: "long",
    label: "Long Range Tower",
    description: "Heavy single hits at reach. The answer to armour.",
    cost: 25,
  },
]);

export interface PowerUnlockDef {
  power: TacticalPowerId;
  label: string;
  cost: number;
}

/**
 * Powers added to the in-run pool.
 *
 * Barrage is not listed — it is available from the start, so a new player has
 * one tactical option to learn the system with.
 */
export const POWER_UNLOCKS: readonly PowerUnlockDef[] = Object.freeze([
  { power: "timeDilation", label: "Time Dilation", cost: 18 },
  { power: "overcharge", label: "Overcharge", cost: 22 },
  { power: "bountyStrike", label: "Bounty Strike", cost: 18 },
]);

export interface CommandUnlockDef {
  command: CommandUpgradeId;
  label: string;
  cost: number;
}

export const COMMAND_UNLOCKS: readonly CommandUnlockDef[] = Object.freeze([
  { command: "rapidResponse", label: "Rapid Response", cost: 20 },
  { command: "spoilsOfWar", label: "Spoils of War", cost: 20 },
  { command: "sensorNet", label: "Sensor Net", cost: 30 },
  { command: "armourDoctrine", label: "Armour Doctrine", cost: 26 },
]);

/** Powers every profile starts with, so a fresh run is playable. */
export const STARTING_POWERS: readonly TacticalPowerId[] = Object.freeze(["barrage"]);
