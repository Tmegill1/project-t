/**
 * The three currencies, and the rules about where each comes from.
 *
 * The separation is the point. Gold buys board presence and is earned by
 * playing well moment to moment. Insignia buys tactical options and comes
 * *only* from lieutenants and bosses, which are optional targets — so spending
 * power is earned by taking risks, not by grinding. Seals persist between runs
 * and are the only thing that survives a loss.
 *
 * Keeping "where can this come from" in one place stops the boundaries eroding.
 * The moment a normal kill pays Insignia, lieutenants stop being a decision.
 */

export type Currency = "gold" | "insignia" | "seals";

export const CURRENCIES = ["gold", "insignia", "seals"] as const satisfies readonly Currency[];

/** What may pay out each currency. */
export type EarningSource =
  | "kill"
  | "wave-clear"
  | "lieutenant"
  | "boss"
  | "run-end"
  | "power";

const VALID_SOURCES: Readonly<Record<Currency, readonly EarningSource[]>> = Object.freeze({
  gold: ["kill", "wave-clear", "power"],
  // Deliberately narrow. See the module comment.
  insignia: ["lieutenant", "boss"],
  seals: ["run-end"],
});

/** Whether a source is allowed to pay a currency. */
export function canEarn(currency: Currency, source: EarningSource): boolean {
  return VALID_SOURCES[currency].includes(source);
}

/** Balances held during a single run. Seals are banked at run end. */
export interface RunCurrencies {
  gold: number;
  insignia: number;
}

export function createRunCurrencies(startingGold: number): RunCurrencies {
  return { gold: Math.max(0, startingGold), insignia: 0 };
}

/**
 * Adds to a balance, refusing sources that are not allowed to pay it.
 *
 * Throws rather than silently ignoring: a wrong source is a design mistake, and
 * the whole economy rests on Insignia staying scarce.
 */
export function earn(
  balances: RunCurrencies,
  currency: "gold" | "insignia",
  amount: number,
  source: EarningSource,
): RunCurrencies {
  if (!canEarn(currency, source)) {
    throw new Error(`${source} may not pay ${currency}`);
  }
  if (amount < 0) {
    throw new Error(`Cannot earn a negative amount of ${currency}`);
  }
  return { ...balances, [currency]: balances[currency] + amount };
}

export interface SpendResult {
  balances: RunCurrencies;
  ok: boolean;
}

/** Spends from a balance. Never goes negative; reports whether it happened. */
export function spend(
  balances: RunCurrencies,
  currency: "gold" | "insignia",
  amount: number,
): SpendResult {
  if (amount < 0 || balances[currency] < amount) {
    return { balances, ok: false };
  }
  return { balances: { ...balances, [currency]: balances[currency] - amount }, ok: true };
}

/**
 * Seals earned at the end of a run.
 *
 * ⚠ NEEDS TUNING — see NOTES-FOR-HUMAN.md. Phase 4 owns persistence; this is
 * here now so the conversion rate is one number in one place when it lands.
 *
 * Unspent Insignia converts, which is what creates the final-wave decision:
 * spend to survive, or bank for permanent progress.
 */
export const SEAL_CONVERSION = Object.freeze({
  perWaveSurvived: 1,
  perBossKilled: 5,
  /** Unspent Insignia is worth less than it would have been if spent. */
  perUnspentInsignia: 0.5,
});

export interface RunSummary {
  wavesSurvived: number;
  bossesKilled: number;
  unspentInsignia: number;
}

export interface SealBreakdown {
  fromWaves: number;
  fromBosses: number;
  fromInsignia: number;
  total: number;
}

/** Seals for a finished run, itemised so the summary screen can show its work. */
export function sealsForRun(summary: RunSummary): SealBreakdown {
  const fromWaves = Math.max(0, summary.wavesSurvived) * SEAL_CONVERSION.perWaveSurvived;
  const fromBosses = Math.max(0, summary.bossesKilled) * SEAL_CONVERSION.perBossKilled;
  const fromInsignia = Math.floor(
    Math.max(0, summary.unspentInsignia) * SEAL_CONVERSION.perUnspentInsignia,
  );

  return {
    fromWaves,
    fromBosses,
    fromInsignia,
    total: fromWaves + fromBosses + fromInsignia,
  };
}
