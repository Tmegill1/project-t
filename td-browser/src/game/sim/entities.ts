/**
 * Plain data types for simulation state.
 *
 * Nothing here imports Phaser, and nothing here renders. These describe what an
 * enemy or tower *is* to the rules; the Phaser classes in src/game/sprites/ own
 * how it looks and delegate every decision to this layer.
 *
 * Note on style: tsconfig sets `erasableSyntaxOnly`, so `enum` is unavailable.
 * Fixed sets are expressed as string unions, with a `const` array alongside when
 * the set needs to be iterated at runtime.
 */

import type { EnemyProperty, SplitSpawn } from "./properties";
import type { EnemyRole } from "./lieutenants";

export type { EnemyProperty, SplitSpawn, EnemyRole };

export interface Vec2 {
  x: number;
  y: number;
}

/** A waypoint on an enemy's route, in world pixels. */
export type PathPoint = Vec2;

export type EnemyKind = "slime" | "ogre" | "bee";

export const ENEMY_KINDS = ["slime", "ogre", "bee"] as const;

export type TowerKind = "basic" | "fast" | "long" | "mortar";

export const TOWER_KINDS = ["basic", "fast", "long", "mortar"] as const;

/**
 * Which sprite row to draw. "side" covers both left and right; horizontal
 * flipping is a view concern driven by `MovementResult.movingLeft`.
 */
export type Facing = "up" | "down" | "side";

/** Simulation state for one live enemy. */
export interface EnemyState {
  readonly id: number;
  readonly kind: EnemyKind;
  /** World position. Mutable: advanced every tick. */
  position: Vec2;
  /** Index of the waypoint currently being travelled toward. */
  pathIndex: number;
  health: number;
  readonly maxHealth: number;
  /** Pixels per second, already scaled by the wave's speed modifier. */
  readonly speed: number;
  /** Gold paid out when killed. */
  readonly reward: number;
  /** Lives lost on leak, before the wave-5 health-scaling rule. */
  readonly lifeLoss: number;
  /** The wave this enemy belongs to, which selects the life-loss rule. */
  readonly wave: number;
  alive: boolean;
  /**
   * Set while a death animation plays. Such an enemy is untargetable and takes
   * no further damage, so its reward cannot be collected twice.
   */
  dying: boolean;

  // --- Phase 1 properties ------------------------------------------------
  /** Which composable properties this enemy carries, for UI and diagnostics. */
  readonly properties: readonly EnemyProperty[];
  /** Flat damage reduction per hit. Zero for an unarmoured enemy. */
  armor: number;
  /** Hits absorbed outright before damage lands. */
  shield: number;
  /** Untargetable by towers without detection. */
  readonly phased: boolean;
  /** What this enemy leaves behind when killed, if anything. */
  readonly splitsInto: SplitSpawn | null;
  /** Simulation timestamp until which the enemy is slowed. */
  slowedUntilMs: number;
  /** Speed multiplier while slowed. 1 means unaffected. */
  slowFactor: number;
  /** Generation, so a splitter's children cannot split forever. */
  readonly generation: number;

  // --- Phase 2 ------------------------------------------------------------
  /** Ordinary enemy, lieutenant, or boss. */
  readonly role: EnemyRole;
  /** Insignia paid on death. Non-zero only for lieutenants and bosses. */
  readonly insigniaReward: number;
  /**
   * Set for lieutenants: reaching the exit costs the player nothing.
   * Read by resolveLeakPenalty.
   */
  readonly exemptFromLifeLoss?: boolean;
}

/** Effective speed after any active slow. */
export function effectiveSpeed(enemy: EnemyState, nowMs: number): number {
  return nowMs < enemy.slowedUntilMs ? enemy.speed * enemy.slowFactor : enemy.speed;
}

/** Simulation state for one placed tower. */
export interface TowerState {
  readonly id: number;
  readonly kind: TowerKind;
  readonly col: number;
  readonly row: number;
  /** World position of the tower's centre. */
  readonly position: Vec2;
  /** Damage per projectile. Previously a constant on the projectile, which is
   *  why all three towers used to hit for the same amount. */
  readonly damage: number;
  /** Targeting radius in world pixels. */
  readonly range: number;
  /** Milliseconds between shots. */
  readonly fireRate: number;
  /** Simulation timestamp of the last shot, in milliseconds. */
  lastFireTime: number;
  /** Armour points ignored per hit. */
  readonly pierce: number;
  /** Splash radius in pixels. Zero means single-target. */
  readonly splashRadius: number;
  /** Can see phased enemies. */
  readonly detection: boolean;
  /** Speed multiplier applied to enemies hit. 1 means no slow. */
  readonly slowFactor: number;
  readonly slowDurationMs: number;
}
