/**
 * Meta-progression rules: what a profile grants, and what it may buy.
 *
 * The ceiling is enforced here, in code, rather than trusted to the data.
 * `passiveBonus` clamps to `META_PASSIVE_CEILING` no matter what the tables
 * say, so a typo in a tier value cannot quietly make the game beatable by
 * grinding. The design is explicit that if meta upgrades beat the game, skill
 * stops mattering — so the guarantee belongs somewhere a typo cannot reach.
 */

import {
  COMMAND_UNLOCKS,
  META_PASSIVES,
  META_PASSIVE_CEILING,
  META_PASSIVE_IDS,
  POWER_UNLOCKS,
  STARTING_POWERS,
  TOWER_UNLOCKS,
} from "../data/metaUpgrades";
import type { MetaPassiveId } from "../data/metaUpgrades";
import type { SaveData } from "../meta/saveSchema";
import type { CommandUpgradeId, TacticalPowerId } from "../data/powers";
import type { TowerKind } from "./entities";

/**
 * Total bonus from a passive, as a fraction.
 *
 * ★ Clamped to the ceiling unconditionally. This is the guarantee the phase
 * rests on and it is asserted directly in metaProgression.test.ts, including
 * against deliberately absurd tier counts.
 */
export function passiveBonus(save: SaveData, id: MetaPassiveId): number {
  const definition = META_PASSIVES[id];
  const tier = Math.max(0, Math.min(definition.maxTier, save.passives[id] ?? 0));
  return Math.min(META_PASSIVE_CEILING, tier * definition.perTier);
}

/** Every passive's bonus, for applying to a run. */
export interface MetaBonuses {
  /** Multiplier on tower damage. Never above 1 + the ceiling. */
  damageMultiplier: number;
  /** Multiplier on starting gold. */
  startingGoldMultiplier: number;
  /** Multiplier on starting lives. */
  startingLivesMultiplier: number;
  /** Multiplier on gold from kills. */
  killGoldMultiplier: number;
}

export function metaBonuses(save: SaveData): MetaBonuses {
  return {
    damageMultiplier: 1 + passiveBonus(save, "veteranCrews"),
    startingGoldMultiplier: 1 + passiveBonus(save, "warChest"),
    startingLivesMultiplier: 1 + passiveBonus(save, "reinforcedCore"),
    killGoldMultiplier: 1 + passiveBonus(save, "quartermaster"),
  };
}

/** Cost of the next tier of a passive. Zero when it is maxed. */
export function passiveCost(save: SaveData, id: MetaPassiveId): number {
  const definition = META_PASSIVES[id];
  const tier = save.passives[id] ?? 0;
  if (tier >= definition.maxTier) return 0;
  return definition.baseCost + tier * definition.costPerTier;
}

export function canBuyPassive(save: SaveData, id: MetaPassiveId): boolean {
  const definition = META_PASSIVES[id];
  const tier = save.passives[id] ?? 0;
  return tier < definition.maxTier && save.seals >= passiveCost(save, id);
}

export interface PurchaseOutcome {
  save: SaveData;
  ok: boolean;
}

/** Buys the next tier of a passive. Pure; refuses when unaffordable or maxed. */
export function buyPassive(save: SaveData, id: MetaPassiveId): PurchaseOutcome {
  if (!canBuyPassive(save, id)) return { save, ok: false };

  const cost = passiveCost(save, id);
  return {
    save: {
      ...save,
      seals: save.seals - cost,
      passives: { ...save.passives, [id]: (save.passives[id] ?? 0) + 1 },
    },
    ok: true,
  };
}

// --- unlocks ----------------------------------------------------------------

/** Towers the player may build this run. Always includes the basic tower. */
export function availableTowers(save: SaveData): TowerKind[] {
  return [...new Set<TowerKind>(["basic", ...save.unlockedTowers])];
}

export function isTowerUnlocked(save: SaveData, tower: TowerKind): boolean {
  return availableTowers(save).includes(tower);
}

/** Tactical powers Insignia may buy this run. */
export function availablePowers(save: SaveData): TacticalPowerId[] {
  return [...new Set<TacticalPowerId>([...STARTING_POWERS, ...save.unlockedPowers])];
}

/** Command upgrades Insignia may buy this run. */
export function availableCommands(save: SaveData): CommandUpgradeId[] {
  return [...new Set(save.unlockedCommands)];
}

export function unlockTower(save: SaveData, tower: TowerKind): PurchaseOutcome {
  const entry = TOWER_UNLOCKS.find((u) => u.tower === tower);
  if (!entry || isTowerUnlocked(save, tower) || save.seals < entry.cost) {
    return { save, ok: false };
  }
  return {
    save: {
      ...save,
      seals: save.seals - entry.cost,
      unlockedTowers: [...save.unlockedTowers, tower],
    },
    ok: true,
  };
}

export function unlockPower(save: SaveData, power: TacticalPowerId): PurchaseOutcome {
  const entry = POWER_UNLOCKS.find((u) => u.power === power);
  if (!entry || availablePowers(save).includes(power) || save.seals < entry.cost) {
    return { save, ok: false };
  }
  return {
    save: {
      ...save,
      seals: save.seals - entry.cost,
      unlockedPowers: [...save.unlockedPowers, power],
    },
    ok: true,
  };
}

export function unlockCommand(save: SaveData, command: CommandUpgradeId): PurchaseOutcome {
  const entry = COMMAND_UNLOCKS.find((u) => u.command === command);
  if (!entry || availableCommands(save).includes(command) || save.seals < entry.cost) {
    return { save, ok: false };
  }
  return {
    save: {
      ...save,
      seals: save.seals - entry.cost,
      unlockedCommands: [...save.unlockedCommands, command],
    },
    ok: true,
  };
}

// --- banking a finished run -------------------------------------------------

export interface RunOutcome {
  wavesSurvived: number;
  bossesKilled: number;
  unspentInsignia: number;
  sealsEarned: number;
}

/** Folds a finished run into the profile. Pure. */
export function bankRun(save: SaveData, outcome: RunOutcome): SaveData {
  const earned = Math.max(0, Math.floor(outcome.sealsEarned));

  return {
    ...save,
    seals: save.seals + earned,
    lifetimeSeals: save.lifetimeSeals + earned,
    stats: {
      runsPlayed: save.stats.runsPlayed + 1,
      bestWave: Math.max(save.stats.bestWave, outcome.wavesSurvived),
      bossesKilled: save.stats.bossesKilled + Math.max(0, outcome.bossesKilled),
    },
  };
}

/** Every passive id, for building the shop UI. */
export function allPassiveIds(): readonly MetaPassiveId[] {
  return META_PASSIVE_IDS;
}
