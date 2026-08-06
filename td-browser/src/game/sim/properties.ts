/**
 * Composable enemy properties.
 *
 * Each property is one answerable problem, and the answers differ. An enemy may
 * carry any combination, which is what stops a single tower build from being
 * correct everywhere.
 *
 * ⚠ Every number here is a placeholder needing playtesting. See
 * NOTES-FOR-HUMAN.md.
 */

import type { EnemyKind } from "./entities";

export type EnemyProperty = "armored" | "shielded" | "swift" | "phased" | "splitter";

export const ENEMY_PROPERTIES = [
  "armored",
  "shielded",
  "swift",
  "phased",
  "splitter",
] as const satisfies readonly EnemyProperty[];

/** What a splitter leaves behind when it dies. */
export interface SplitSpawn {
  kind: EnemyKind;
  count: number;
  /** Health of each child as a fraction of the parent's maximum. */
  healthFraction: number;
}

/** The defensive and movement stats a property set produces. */
export interface PropertyStats {
  /** Flat damage reduction per hit. */
  armor: number;
  /** Hits absorbed outright before damage lands. */
  shield: number;
  /** Pixels per second. */
  speed: number;
  /** Untargetable by towers without detection. */
  phased: boolean;
  splitsInto: SplitSpawn | null;
}

/**
 * Tuning values, one per property.
 *
 * ⚠ NEEDS TUNING. `armorValue: 4` against a 2-damage fast tower means zero
 * damage — armour is a hard counter, not a tax. That is deliberate: it is what
 * makes the choice real. If it plays as too punishing, either lower it or add a
 * minimum-damage floor in resolveDamage.
 */
export const PROPERTY_VALUES = Object.freeze({
  /** Flat reduction per hit. Beaten by high per-hit damage or pierce. */
  armorValue: 4,
  /** Hits absorbed regardless of size. Beaten by rapid cheap fire. */
  shieldHits: 6,
  /** Speed multiplier. Beaten by slows and stuns. */
  swiftSpeedMultiplier: 1.6,
  /** Children spawned on death, and how much health each carries. */
  split: Object.freeze({ count: 2, healthFraction: 0.4 }),
});

/** What each property splits into. Splitters become the next tier down. */
const SPLIT_TARGET: Readonly<Record<EnemyKind, EnemyKind>> = Object.freeze({
  ogre: "slime",
  slime: "bee",
  // A bee is the smallest enemy, so a splitting bee makes more bees.
  bee: "bee",
});

export function hasProperty(
  properties: readonly EnemyProperty[] | undefined,
  property: EnemyProperty,
): boolean {
  return properties?.includes(property) ?? false;
}

/**
 * Applies a property set to an enemy's base stats.
 *
 * Pure, order-independent, and idempotent per property — a repeated property
 * applies once, so a data typo cannot produce a double-speed enemy.
 */
export function applyProperties(
  base: PropertyStats,
  properties: readonly EnemyProperty[],
  kind: EnemyKind = "slime",
): PropertyStats {
  const unique = new Set(properties);

  return {
    armor: unique.has("armored") ? base.armor + PROPERTY_VALUES.armorValue : base.armor,
    shield: unique.has("shielded") ? base.shield + PROPERTY_VALUES.shieldHits : base.shield,
    speed: unique.has("swift")
      ? base.speed * PROPERTY_VALUES.swiftSpeedMultiplier
      : base.speed,
    phased: unique.has("phased") ? true : base.phased,
    splitsInto: unique.has("splitter")
      ? {
          kind: SPLIT_TARGET[kind],
          count: PROPERTY_VALUES.split.count,
          healthFraction: PROPERTY_VALUES.split.healthFraction,
        }
      : base.splitsInto,
  };
}

export interface PropertyDescription {
  property: EnemyProperty;
  label: string;
  /** What the property does, for the player. */
  effect: string;
  /** How to beat it. The UI must communicate this — a property the player
   *  cannot read is a difficulty spike, not a decision. */
  counter: string;
}

const DESCRIPTIONS: Readonly<Record<EnemyProperty, Omit<PropertyDescription, "property">>> =
  Object.freeze({
    armored: {
      label: "Armoured",
      effect: `Blocks ${PROPERTY_VALUES.armorValue} damage from every hit`,
      counter: "Heavy single hits, or pierce",
    },
    shielded: {
      label: "Shielded",
      effect: `Absorbs the next ${PROPERTY_VALUES.shieldHits} hits, however big`,
      counter: "Rapid, cheap fire",
    },
    swift: {
      label: "Swift",
      effect: `Moves ${Math.round((PROPERTY_VALUES.swiftSpeedMultiplier - 1) * 100)}% faster`,
      counter: "Slows and stuns",
    },
    phased: {
      label: "Phased",
      effect: "Cannot be targeted without detection",
      counter: "A tower with detection",
    },
    splitter: {
      label: "Splitter",
      effect: `Breaks into ${PROPERTY_VALUES.split.count} smaller enemies on death`,
      counter: "Splash and area damage",
    },
  });

/** Describes a property set for the UI, in a stable canonical order. */
export function describeProperties(
  properties: readonly EnemyProperty[],
): PropertyDescription[] {
  const present = new Set(properties);
  return ENEMY_PROPERTIES.filter((p) => present.has(p)).map((property) => ({
    property,
    ...DESCRIPTIONS[property],
  }));
}
