/**
 * Currency arithmetic.
 *
 * Pure functions only — no balance is stored here. Gold currently lives as a
 * private field on `UIScene`, which delegates the maths to this module. Moving
 * ownership out of the view layer is deferred to Phase 2, where Insignia and
 * Seals arrive and a real multi-currency owner is needed anyway.
 */

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
