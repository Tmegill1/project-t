/**
 * Damage resolution.
 *
 * Every point of damage in the game routes through `resolveDamage`. Before this
 * module existed, damage was a hardcoded constant on the projectile
 * (`Projectile.damage = 3`) and `BaseEnemy.takeDamage` did the arithmetic
 * inline — which meant all three towers dealt identical damage and no damage
 * rule could be tested without a live scene.
 *
 * Two defensive properties resolve here, and they are deliberately answered by
 * opposite tower profiles:
 *
 * - **Armour** reduces every hit by a flat amount, so it punishes many small
 *   hits and is beaten by few large ones (or by pierce).
 * - **Shields** absorb a whole hit regardless of its size, so they punish large
 *   hits and are beaten by rapid cheap fire.
 *
 * If either could be answered by the same build as the other, enemy properties
 * would be decoration. `damage.test.ts` asserts the opposition directly.
 */

/** Whatever is dealing the damage: a projectile, a splash, a tactical power. */
export interface DamageSource {
  /** Damage before any target-side reduction. */
  damage: number;
  /**
   * Points of armour ignored. Answers armour only — never shields, because a
   * single upgrade path that countered both would counter everything.
   */
  pierce?: number;
}

/** Whatever is receiving it. Deliberately structural, not an `EnemyState`, so
 *  bosses and any future destructible can be passed without adaptation. */
export interface DamageTarget {
  health: number;
  maxHealth: number;
  /** A target that is not alive absorbs nothing. */
  alive: boolean;
  /** Flat reduction applied to each hit that gets past any shield. */
  armor?: number;
  /** Remaining hits this target absorbs outright. */
  shield?: number;
}

/**
 * Surrounding facts a damage calculation may depend on.
 *
 * Currently empty. Phase 2's Overcharge multiplier resolves here.
 */
export type DamageContext = Record<string, never>;

export interface DamageResult {
  /** Damage actually absorbed by health. Overkill is not counted: a 50-damage
   *  hit on a 5-health target dealt 5. */
  damageDealt: number;
  /** Health after the hit, never below zero. */
  remainingHealth: number;
  /** Shield charges left after the hit. */
  remainingShield: number;
  /** True if a shield charge swallowed this hit whole. */
  shieldAbsorbed: boolean;
  /** Damage removed by armour, for UI feedback and balance diagnostics. */
  armorAbsorbed: number;
  /** True only on the hit that brings a living target to zero. */
  lethal: boolean;
}

export function resolveDamage(
  source: DamageSource,
  target: DamageTarget,
  _context: DamageContext = {},
): DamageResult {
  const shield = Math.max(0, target.shield ?? 0);

  // A corpse absorbs nothing. Enemies linger in the scene while their death
  // animation plays, and without this a second projectile already in flight
  // would report a kill again and pay the reward twice.
  if (!target.alive || target.health <= 0) {
    return {
      damageDealt: 0,
      remainingHealth: Math.max(0, target.health),
      remainingShield: shield,
      shieldAbsorbed: false,
      armorAbsorbed: 0,
      lethal: false,
    };
  }

  // Negative damage must not heal. Nothing produces it today, but a bad data
  // value should be inert rather than a source of invincible enemies.
  const incoming = Math.max(0, source.damage);

  // A zero-damage source must not strip a shield charge for free — otherwise a
  // tower that cannot hurt an armoured target could still peel its shield, and
  // armour would stop being a counter.
  if (shield > 0 && incoming > 0) {
    return {
      damageDealt: 0,
      remainingHealth: target.health,
      remainingShield: shield - 1,
      shieldAbsorbed: true,
      armorAbsorbed: 0,
      lethal: false,
    };
  }

  const armor = Math.max(0, target.armor ?? 0);
  const effectiveArmor = Math.max(0, armor - Math.max(0, source.pierce ?? 0));
  const afterArmor = Math.max(0, incoming - effectiveArmor);

  const damageDealt = Math.min(afterArmor, target.health);
  const remainingHealth = target.health - damageDealt;

  return {
    damageDealt,
    remainingHealth,
    remainingShield: shield,
    shieldAbsorbed: false,
    armorAbsorbed: incoming - afterArmor,
    lethal: remainingHealth <= 0 && damageDealt > 0,
  };
}
