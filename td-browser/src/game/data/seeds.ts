/**
 * Default seeds for the game's random systems.
 *
 * ⚠ BEHAVIOUR CHANGE — see NOTES-FOR-HUMAN.md.
 *
 * Map generation used to call bare `Math.random()` at module load, so the
 * twelve blocked tiles on each map landed somewhere different on every page
 * load. That is gameplay randomness — blocked tiles remove build space — and
 * it was impossible to reproduce, which makes a balance report meaningless
 * ("it was too hard" on which layout?) and makes the headless harness's
 * "same seed, same result" guarantee unattainable.
 *
 * Seeding fixes the layout. The trade-off is that the map is now identical
 * every run rather than varying. To restore per-run variety while keeping a
 * run reproducible, generate one seed at startup, show it to the player, and
 * pass it in — the generators already accept one.
 */

/** Layout of blocked tiles on the first map. */
export const DEFAULT_DEMO_MAP_SEED = 20260804;

/** Layout of blocked tiles on the second map. */
export const DEFAULT_MAP2_SEED = 20260805;

/** Scatter of purely cosmetic decoration sprites. */
export const DEFAULT_DECORATION_SEED = 771144;
