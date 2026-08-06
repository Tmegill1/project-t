/**
 * Every tunable economy number, in one file.
 *
 * The phase's definition of done asks for exactly that: a single place to
 * adjust pacing without hunting through logic. Nothing here contains rules —
 * the arithmetic lives in sim/economy.ts.
 *
 * ⚠ Every number is a placeholder needing playtesting.
 * See NOTES-FOR-HUMAN.md.
 */

/**
 * Total towers a map allows, across every kind.
 *
 * A difficulty lever that asks the player a question instead of inflating a
 * number. Scaling monster health harder just demands more damage; a tighter
 * board demands *choices* — which towers, where, and how deep to commit each
 * one, given the cross-path rule means a tower cannot do everything.
 *
 * This sits alongside the per-kind caps rather than replacing them: the budget
 * decides how much board you get, the per-kind caps stop that board being one
 * tower repeated.
 *
 * ⚠ NEEDS TUNING — these are the numbers most likely to change after a
 * playtest, and the most powerful for setting how hard a map feels.
 */
export const TOWER_BUDGET = Object.freeze({
  /** The introductory map: generous, so the systems can be learned. */
  demoMap: 16,
  /** The larger second map: more ground to cover, but proportionally tighter. */
  map2: 20,
});

export const ECONOMY = Object.freeze({
  /** Gold the player starts with, per map. */
  startingGold: Object.freeze({ demoMap: 100, map2: 250 }),

  startingLives: 20,

  /** Half of everything sunk into a tower comes back on sale. */
  sellRefundFraction: 0.5,

  waveClear: Object.freeze({
    /** Paid for clearing a wave at all. */
    baseBonus: 20,
    /** Added per wave number, so later waves pay more. */
    bonusPerWave: 5,
    /**
     * A wave cleared at or under this pays the full speed bonus; one taking
     * `slowClearMs` or longer pays none. Rewards a defence that actually kills
     * rather than one that survives.
     */
    fastClearMs: 20_000,
    slowClearMs: 60_000,
    maxSpeedBonus: 40,
  }),

  callEarly: Object.freeze({
    /**
     * How long the player gets between waves before the next starts on its own.
     * Calling early converts the unused part into gold.
     */
    prepDurationMs: 20_000,
    /** Gold per full second of prep time given up. */
    goldPerSecond: 3,
    /**
     * Ceiling on a single call-early payout, so the reward cannot dwarf the
     * wave-clear bonus and turn the game into a rush simulator.
     */
    maxBonus: 45,
  }),

  interest: Object.freeze({
    /** Fraction of banked gold paid at each wave clear. */
    ratePerWave: 0.05,
    /**
     * Ceiling on interest per wave. Uncapped compounding makes hoarding
     * strictly better than building, which is the opposite of a tower defence.
     */
    maxPerWave: 30,
    /** Balance below which no interest is paid, so it never trickles. */
    minimumBalance: 50,
  }),
});
