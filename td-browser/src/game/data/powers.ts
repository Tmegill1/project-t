/**
 * Tactical powers and command upgrades — everything Insignia buys.
 *
 * Two kinds, deliberately different in shape:
 *
 * - **Tactical powers** are cast, take effect for a few seconds, and go on
 *   cooldown. They answer a moment: a wave that is about to break through.
 * - **Command upgrades** are bought once and last the run. They answer a
 *   strategy: a build that needs detection everywhere, or wants more Insignia.
 *
 * Insignia comes only from lieutenants and bosses, so every purchase here traces
 * back to a risk the player chose to take. Spending on a power now means not
 * having the Insignia for a command upgrade later, which is the second decision
 * layered on top of the first.
 *
 * ⚠ Every number here is a placeholder needing playtesting.
 * See NOTES-FOR-HUMAN.md.
 */

export type TacticalPowerId = "barrage" | "timeDilation" | "overcharge" | "bountyStrike";

export const TACTICAL_POWER_IDS = [
  "barrage",
  "timeDilation",
  "overcharge",
  "bountyStrike",
] as const satisfies readonly TacticalPowerId[];

export interface TacticalPowerDef {
  label: string;
  /** Shown on the button. Must read without a hover, for touch. */
  description: string;
  /** Insignia to unlock it for the run. */
  cost: number;
  /** Milliseconds before it may be cast again. */
  cooldownMs: number;
  /** How long its effect lasts. Zero means instant. */
  durationMs: number;
  effects: PowerEffects;
}

export interface PowerEffects {
  /** Multiplies all tower damage while active. */
  damageMultiplier?: number;
  /** Multiplies all enemy speed while active. Below 1 slows them. */
  enemySpeedMultiplier?: number;
  /** Multiplies gold from kills while active. */
  goldMultiplier?: number;
  /** Instant damage dealt to every enemy on the board. */
  instantDamage?: number;
  /** Instant damage ignores this much armour. */
  instantPierce?: number;
}

export const TACTICAL_POWERS: Readonly<Record<TacticalPowerId, TacticalPowerDef>> = Object.freeze({
  // The panic button. Answers a wave already past the towers, since it does not
  // care where anything is.
  barrage: {
    label: "Barrage",
    description: "Hits every enemy on the board for 25, ignoring 5 armour.",
    cost: 2,
    cooldownMs: 30_000,
    durationMs: 0,
    effects: { instantDamage: 25, instantPierce: 5 },
  },
  // Buys time rather than dealing damage. Answers swift waves and overruns.
  timeDilation: {
    label: "Time Dilation",
    description: "Slows every enemy to 40% speed for 6 seconds.",
    cost: 2,
    cooldownMs: 40_000,
    durationMs: 6_000,
    effects: { enemySpeedMultiplier: 0.4 },
  },
  // Raw output. Answers a single tanky target, and pairs with a burst build.
  overcharge: {
    label: "Overcharge",
    description: "Doubles all tower damage for 8 seconds.",
    cost: 3,
    cooldownMs: 45_000,
    durationMs: 8_000,
    effects: { damageMultiplier: 2 },
  },
  // The economic option. Weakest in a crisis, best when the board is winning.
  bountyStrike: {
    label: "Bounty Strike",
    description: "Triples gold from kills for 10 seconds.",
    cost: 2,
    cooldownMs: 50_000,
    durationMs: 10_000,
    effects: { goldMultiplier: 3 },
  },
});

export type CommandUpgradeId =
  | "rapidResponse"
  | "spoilsOfWar"
  | "sensorNet"
  | "armourDoctrine";

export const COMMAND_UPGRADE_IDS = [
  "rapidResponse",
  "spoilsOfWar",
  "sensorNet",
  "armourDoctrine",
] as const satisfies readonly CommandUpgradeId[];

export interface CommandUpgradeDef {
  label: string;
  description: string;
  cost: number;
  effects: CommandEffects;
}

export interface CommandEffects {
  /** Multiplies every power's cooldown. Below 1 is faster. */
  cooldownMultiplier?: number;
  /** Multiplies Insignia from lieutenants and bosses. */
  insigniaMultiplier?: number;
  /** Gives every tower detection. */
  globalDetection?: boolean;
  /** Adds pierce to every tower. */
  globalPierce?: number;
}

export const COMMAND_UPGRADES: Readonly<Record<CommandUpgradeId, CommandUpgradeDef>> =
  Object.freeze({
    rapidResponse: {
      label: "Rapid Response",
      description: "All power cooldowns fall by 30%.",
      cost: 4,
      effects: { cooldownMultiplier: 0.7 },
    },
    // Compounds: buying it early pays for everything after it, which is a real
    // tempo-versus-value decision.
    spoilsOfWar: {
      label: "Spoils of War",
      description: "Lieutenants and bosses pay 50% more Insignia.",
      cost: 4,
      effects: { insigniaMultiplier: 1.5 },
    },
    // An alternative to committing a tower to the Marksman branch. Expensive on
    // purpose — it should not be the obvious answer to phasing.
    sensorNet: {
      label: "Sensor Net",
      description: "Every tower can see phased enemies.",
      cost: 6,
      effects: { globalDetection: true },
    },
    // Likewise for armour: help, but not a substitute for a Siege tower.
    armourDoctrine: {
      label: "Armour Doctrine",
      description: "Every tower ignores 3 armour.",
      cost: 5,
      effects: { globalPierce: 3 },
    },
  });
