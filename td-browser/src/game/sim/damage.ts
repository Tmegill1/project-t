/**
 * Damage resolution.
 *
 * Every point of damage in the game routes through `resolveDamage`. Before this
 * module existed, damage was a hardcoded constant on the projectile
 * (`Projectile.damage = 3`) and `BaseEnemy.takeDamage` did the arithmetic
 * inline — which meant all three towers dealt identical damage and no damage
 * rule could be tested without a live scene.
 */

/** Whatever is dealing the damage: a projectile, a splash, a tactical power. */
export interface DamageSource {
  /** Damage before any target-side reduction. */
  damage: number;
}

/** Whatever is receiving it. Deliberately structural, not an `EnemyState`, so
 *  bosses and any future destructible can be passed without adaptation. */
export interface DamageTarget {
  health: number;
  maxHealth: number;
  /** A target that is not alive absorbs nothing. */
  alive: boolean;
}

/**
 * Surrounding facts a damage calculation may depend on.
 *
 * Currently empty. It is part of the signature because Phase 1's armour and
 * shield rules and Phase 2's Overcharge multiplier resolve here, and threading
 * a parameter through later would touch every call site.
 */
export type DamageContext = Record<string, never>;

export interface DamageResult {
  /** Damage actually absorbed. Overkill is not counted: a 50-damage hit on a
   *  5-health target dealt 5. */
  damageDealt: number;
  /** Health after the hit, never below zero. */
  remainingHealth: number;
  /** True only on the hit that brings a living target to zero. */
  lethal: boolean;
}

export function resolveDamage(
  source: DamageSource,
  target: DamageTarget,
  _context: DamageContext = {},
): DamageResult {
  // A corpse absorbs nothing. Enemies linger in the scene while their death
  // animation plays, and without this a second projectile already in flight
  // would report a kill again and pay the reward twice.
  if (!target.alive || target.health <= 0) {
    return { damageDealt: 0, remainingHealth: Math.max(0, target.health), lethal: false };
  }

  // Negative damage must not heal. Nothing produces it today, but a bad data
  // value should be inert rather than a source of invincible enemies.
  const incoming = Math.max(0, source.damage);
  const damageDealt = Math.min(incoming, target.health);
  const remainingHealth = target.health - damageDealt;

  return {
    damageDealt,
    remainingHealth,
    lethal: remainingHealth <= 0 && damageDealt > 0,
  };
}
