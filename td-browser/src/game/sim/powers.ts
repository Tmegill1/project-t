/**
 * Power state: what is unlocked, what is on cooldown, what is currently active,
 * and what all of that adds up to right now.
 *
 * Kept pure and timestamp-driven rather than tick-driven. A cooldown is "ready
 * at time T", not "N ticks remaining", so the same state behaves identically
 * whether it is advanced by Phaser's clock or by the headless harness's fixed
 * timestep — and an effect cannot expire late because a frame was long.
 */

import { COMMAND_UPGRADES, TACTICAL_POWERS } from "../data/powers";
import type {
  CommandUpgradeId,
  TacticalPowerId,
} from "../data/powers";

export interface ActiveEffect {
  power: TacticalPowerId;
  /** Simulation timestamp at which this effect stops applying. */
  expiresAtMs: number;
}

export interface PowerState {
  /** Powers the player has bought this run. */
  unlocked: TacticalPowerId[];
  /** Command upgrades bought this run. */
  commands: CommandUpgradeId[];
  /** Per power, the timestamp it may next be cast. */
  readyAtMs: Partial<Record<TacticalPowerId, number>>;
  active: ActiveEffect[];
}

export function createPowerState(): PowerState {
  return { unlocked: [], commands: [], readyAtMs: {}, active: [] };
}

/** Everything the rest of the simulation needs to know about active effects. */
export interface GlobalModifiers {
  damageMultiplier: number;
  enemySpeedMultiplier: number;
  goldMultiplier: number;
  insigniaMultiplier: number;
  cooldownMultiplier: number;
  bonusPierce: number;
  globalDetection: boolean;
}

export function noModifiers(): GlobalModifiers {
  return {
    damageMultiplier: 1,
    enemySpeedMultiplier: 1,
    goldMultiplier: 1,
    insigniaMultiplier: 1,
    cooldownMultiplier: 1,
    bonusPierce: 0,
    globalDetection: false,
  };
}

/** Command upgrades only. Split out because they never expire. */
export function commandModifiers(state: PowerState): GlobalModifiers {
  const modifiers = noModifiers();

  for (const id of new Set(state.commands)) {
    const effects = COMMAND_UPGRADES[id].effects;
    if (effects.cooldownMultiplier) modifiers.cooldownMultiplier *= effects.cooldownMultiplier;
    if (effects.insigniaMultiplier) modifiers.insigniaMultiplier *= effects.insigniaMultiplier;
    if (effects.globalPierce) modifiers.bonusPierce += effects.globalPierce;
    if (effects.globalDetection) modifiers.globalDetection = true;
  }

  return modifiers;
}

/**
 * Everything in force at `nowMs` — command upgrades plus unexpired effects.
 *
 * Expiry is evaluated here rather than by a sweep, so a caller that forgets to
 * prune still gets correct answers.
 */
export function currentModifiers(state: PowerState, nowMs: number): GlobalModifiers {
  const modifiers = commandModifiers(state);

  for (const effect of state.active) {
    if (effect.expiresAtMs <= nowMs) continue;

    const powerEffects = TACTICAL_POWERS[effect.power].effects;
    if (powerEffects.damageMultiplier) modifiers.damageMultiplier *= powerEffects.damageMultiplier;
    if (powerEffects.enemySpeedMultiplier) {
      modifiers.enemySpeedMultiplier *= powerEffects.enemySpeedMultiplier;
    }
    if (powerEffects.goldMultiplier) modifiers.goldMultiplier *= powerEffects.goldMultiplier;
  }

  return modifiers;
}

/** Drops effects that have expired. Housekeeping only — see currentModifiers. */
export function pruneExpired(state: PowerState, nowMs: number): PowerState {
  return { ...state, active: state.active.filter((e) => e.expiresAtMs > nowMs) };
}

export function isUnlocked(state: PowerState, power: TacticalPowerId): boolean {
  return state.unlocked.includes(power);
}

/** Cooldown for a power, after any command upgrades. */
export function effectiveCooldown(state: PowerState, power: TacticalPowerId): number {
  return Math.round(TACTICAL_POWERS[power].cooldownMs * commandModifiers(state).cooldownMultiplier);
}

/** Milliseconds until a power may be cast. Zero means ready. */
export function cooldownRemaining(
  state: PowerState,
  power: TacticalPowerId,
  nowMs: number,
): number {
  return Math.max(0, (state.readyAtMs[power] ?? 0) - nowMs);
}

export function canCast(state: PowerState, power: TacticalPowerId, nowMs: number): boolean {
  return isUnlocked(state, power) && cooldownRemaining(state, power, nowMs) === 0;
}

export interface CastResult {
  state: PowerState;
  ok: boolean;
  /** Damage to apply to every enemy immediately, if any. */
  instantDamage: number;
  instantPierce: number;
}

/** Casts a power. Refuses if it is locked or still cooling down. */
export function castPower(
  state: PowerState,
  power: TacticalPowerId,
  nowMs: number,
): CastResult {
  if (!canCast(state, power, nowMs)) {
    return { state, ok: false, instantDamage: 0, instantPierce: 0 };
  }

  const definition = TACTICAL_POWERS[power];
  const next: PowerState = {
    ...state,
    readyAtMs: { ...state.readyAtMs, [power]: nowMs + effectiveCooldown(state, power) },
    active:
      definition.durationMs > 0
        ? [
            // Recasting refreshes rather than stacking, so a duration cannot be
            // doubled by spamming the button the instant it comes off cooldown.
            ...state.active.filter((e) => e.power !== power),
            { power, expiresAtMs: nowMs + definition.durationMs },
          ]
        : state.active,
  };

  return {
    state: next,
    ok: true,
    instantDamage: definition.effects.instantDamage ?? 0,
    instantPierce: definition.effects.instantPierce ?? 0,
  };
}

export interface PurchaseResult {
  state: PowerState;
  ok: boolean;
  cost: number;
}

/** Unlocks a tactical power. Refuses a duplicate rather than charging twice. */
export function unlockPower(
  state: PowerState,
  power: TacticalPowerId,
  availableInsignia: number,
): PurchaseResult {
  const cost = TACTICAL_POWERS[power].cost;
  if (isUnlocked(state, power) || availableInsignia < cost) {
    return { state, ok: false, cost };
  }
  return { state: { ...state, unlocked: [...state.unlocked, power] }, ok: true, cost };
}

/** Buys a command upgrade. Refuses a duplicate. */
export function buyCommandUpgrade(
  state: PowerState,
  upgrade: CommandUpgradeId,
  availableInsignia: number,
): PurchaseResult {
  const cost = COMMAND_UPGRADES[upgrade].cost;
  if (state.commands.includes(upgrade) || availableInsignia < cost) {
    return { state, ok: false, cost };
  }
  return { state: { ...state, commands: [...state.commands, upgrade] }, ok: true, cost };
}
