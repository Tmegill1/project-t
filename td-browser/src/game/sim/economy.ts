/**
 * Currency arithmetic.
 *
 * Pure functions only — no balance is stored here. Gold currently lives as a
 * private field on `UIScene`, which delegates the maths to this module. Moving
 * ownership out of the view layer is deferred to Phase 2, where Insignia and
 * Seals arrive and a real multi-currency owner is needed anyway.
 */

import { ECONOMY } from "../data/economy";

/**
 * Whether a balance covers a cost.
 *
 * Reproduces `UIScene.canAfford` exactly, including the `balance > 0` clause.
 * That clause makes a zero-cost purchase fail at a zero balance, which is odd,
 * but Phase 0 must not change visible behaviour. Logged in NOTES-FOR-HUMAN.md.
 */
export function canAfford(balance: number, cost: number): boolean {
  return balance > 0 && balance >= cost;
}

export interface PurchaseResult {
  /** The balance after the attempt — unchanged when the purchase failed. */
  balance: number;
  ok: boolean;
}

/** Attempts a purchase. Never drives the balance negative. */
export function purchase(balance: number, cost: number): PurchaseResult {
  if (!canAfford(balance, cost)) {
    return { balance, ok: false };
  }
  return { balance: balance - cost, ok: true };
}

/** Gold returned for selling a tower: half its price, rounded down.
 *  Matches `GameScene.sellTower`. */
export function sellRefund(cost: number): number {
  return Math.max(0, Math.floor(cost / 2));
}

/**
 * Price of the next tower of a type, given how many are already owned.
 *
 * Mirrors `TowerManager.getTowerCost`: each tower of a type raises the price of
 * the next by a fixed step (20 basic / 30 fast / 100 long range). This is the
 * game's current progression gate, alongside per-type hard caps. Phase 1 must
 * decide explicitly whether upgrades replace or coexist with it.
 */
export function escalatedCost(base: number, owned: number, escalation: number): number {
  return base + Math.max(0, owned) * escalation;
}

// --- Phase 3: wave economy --------------------------------------------------

export interface WaveClearReward {
  base: number;
  /** Extra for clearing quickly. */
  speed: number;
  /** Interest on banked gold. */
  interest: number;
  total: number;
}

/**
 * Gold paid for clearing a wave.
 *
 * Three parts, deliberately: a flat amount so clearing always pays, a speed
 * component so a defence that kills beats one that merely survives, and
 * interest so banking has a point. Itemised because the UI should show the
 * player *why* they were paid, or the incentives stay invisible.
 */
export function waveClearReward(
  waveNumber: number,
  clearTimeMs: number,
  bankedGold: number,
): WaveClearReward {
  const config = ECONOMY.waveClear;

  const base = config.baseBonus + Math.max(0, waveNumber) * config.bonusPerWave;

  // Linear between the fast and slow thresholds, clamped at both ends.
  const span = Math.max(1, config.slowClearMs - config.fastClearMs);
  const slowness = (Math.max(0, clearTimeMs) - config.fastClearMs) / span;
  const speed = Math.round(config.maxSpeedBonus * clamp01(1 - slowness));

  return {
    base,
    speed,
    interest: interestOn(bankedGold),
    total: base + speed + interestOn(bankedGold),
  };
}

/**
 * Interest on banked gold, capped.
 *
 * The cap is the load-bearing part. Uncapped compounding makes hoarding
 * strictly better than building, which inverts the whole game.
 */
export function interestOn(bankedGold: number): number {
  const config = ECONOMY.interest;
  if (bankedGold < config.minimumBalance) return 0;

  return Math.min(config.maxPerWave, Math.floor(bankedGold * config.ratePerWave));
}

/**
 * Gold for starting a wave early, proportional to the prep time given up.
 *
 * Capped so rushing cannot dominate the wave-clear bonus and reduce the game
 * to a race.
 */
export function callEarlyBonus(remainingPrepMs: number): number {
  const config = ECONOMY.callEarly;
  const seconds = Math.floor(clamp(remainingPrepMs, 0, config.prepDurationMs) / 1000);
  return Math.min(config.maxBonus, seconds * config.goldPerSecond);
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}
