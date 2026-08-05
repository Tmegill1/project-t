/**
 * What it costs the player when an enemy reaches the exit.
 *
 * Extracted from `BaseEnemy.update()`, where the rule was inlined twice.
 */

/** Past this wave, a leak costs the enemy's remaining health instead of its
 *  flat life value. */
export const LIFE_LOSS_SCALING_WAVE = 5;

export interface LeakingEnemy {
  /** Flat lives lost, used at or below the scaling wave. */
  lifeLoss: number;
  /** Health remaining at the moment of the leak. */
  health: number;
  /**
   * Leaves without costing the player anything.
   *
   * Phase 2's lieutenants escape with their Insignia at zero life cost — the
   * escape must read as an opportunity cost, never a punishment, or the choice
   * to let one go is not a real choice. Nothing sets this yet.
   */
  exemptFromLifeLoss?: boolean;
}

/** Lives the player loses. Pure — does not mutate the enemy. */
export function resolveLeakPenalty(enemy: LeakingEnemy, wave: number): number {
  if (enemy.exemptFromLifeLoss) return 0;

  if (wave > LIFE_LOSS_SCALING_WAVE) {
    // Late waves punish leaks in proportion to how much of the enemy survived,
    // so chipping a tanky enemy still helps even if it gets through.
    return Math.max(1, Math.ceil(enemy.health));
  }

  return enemy.lifeLoss;
}
