/**
 * Typed wrapper over the scene event bus.
 *
 * Phaser's `scene.events` stays the transport — this adds names and payload
 * types on top. Previously every emit and listener was untyped, so nothing
 * checked that the two agreed: a renamed event or a changed payload failed
 * silently at runtime.
 *
 * The wrapper takes a structural emitter rather than importing Phaser, which
 * keeps it testable without a scene. `Phaser.Events.EventEmitter` satisfies
 * the interface as-is.
 */

import type { EnemyKind, TowerKind } from "./sim/entities";
import type { SealBreakdown } from "./sim/currencies";
import type { CommandUpgradeId, TacticalPowerId } from "./data/powers";

/** How a run finished, for `runEnded`. */
export type RunOutcome = "victory" | "defeat" | "quit";

/**
 * Every event on the bus, with its payload as a tuple.
 *
 * All camelCase. The five original names were kebab-case, and renaming them
 * used to be genuinely dangerous — Phaser's emitter takes any string, so a
 * missed call site fails silently at runtime rather than at compile time.
 * Once every emit and listener went through the typed wrapper, the compiler
 * could prove the rename complete, so it was done.
 */
export interface GameEventMap {
  /** An enemy died. Payload is the gold reward. */
  "enemyKilled": [reward: number];
  /** An enemy reached the exit. Payload is lives lost, already resolved. */
  "enemyReachedGoal": [lifeLoss: number];
  /** Lives hit zero. */
  "gameOver": [];
  /** The player picked a tower to place, or cleared the selection. */
  "towerSelected": [towerType: unknown];
  /** A tower was bought. Payload is the price paid. */
  "purchaseTower": [cost: number];

  /** A wave began. */
  waveStarted: [waveNumber: number];
  /** Every enemy in a wave is dead or through. */
  waveCleared: [waveNumber: number];
  /** A tower was placed on the board. */
  towerPlaced: [kind: TowerKind, col: number, row: number];
  /** A tower gained a tier on one of its branches. Phase 1. */
  towerUpgraded: [kind: TowerKind, branch: string, tier: number];
  /** The run is over, whichever way it went. */
  runEnded: [outcome: RunOutcome, waveReached: number];
  /** A lieutenant or boss left with its Insignia. Phase 2. */
  enemyEscaped: [kind: EnemyKind, insignia: number];

  // --- Phase 2: currencies ------------------------------------------------
  /** Gold balance changed. Payload is the new total and the delta. */
  goldChanged: [total: number, delta: number];
  /** Insignia balance changed. Only lieutenants and bosses raise it. */
  insigniaChanged: [total: number, delta: number];
  /** Seals banked at the end of a run. Phase 4 persists them. */
  sealsEarned: [total: number, breakdown: SealBreakdown];

  // --- Phase 2: lieutenants and powers ------------------------------------
  /** A lieutenant entered the board. */
  lieutenantSpawned: [wave: number];
  /** A lieutenant was killed. Payload is the Insignia paid. */
  lieutenantKilled: [insignia: number];
  /** A lieutenant reached the exit. Costs zero lives, by design. */
  lieutenantEscaped: [wave: number];
  /** A boss was killed. Payload is the Insignia paid. */
  bossKilled: [insignia: number];
  /** A tactical power was cast. */
  powerCast: [power: TacticalPowerId, atMs: number];
  /** A tactical power was unlocked with Insignia. */
  powerUnlocked: [power: TacticalPowerId, cost: number];
  /** A command upgrade was bought with Insignia. */
  commandPurchased: [upgrade: CommandUpgradeId, cost: number];
}

export type GameEventName = keyof GameEventMap;

/**
 * Every event name, for tests and diagnostics.
 *
 * Kept in step with `GameEventMap` by the `satisfies` clause: adding a key to
 * the map without adding it here is a compile error.
 */
export const GAME_EVENT_NAMES = [
  "enemyKilled",
  "enemyReachedGoal",
  "gameOver",
  "towerSelected",
  "purchaseTower",
  "waveStarted",
  "waveCleared",
  "towerPlaced",
  "towerUpgraded",
  "runEnded",
  "enemyEscaped",
  "goldChanged",
  "insigniaChanged",
  "sealsEarned",
  "lieutenantSpawned",
  "lieutenantKilled",
  "lieutenantEscaped",
  "bossKilled",
  "powerCast",
  "powerUnlocked",
  "commandPurchased",
] as const satisfies readonly GameEventName[];

/** The part of Phaser's EventEmitter this wrapper needs. */
export interface EventEmitterLike {
  emit(event: string, ...args: unknown[]): boolean;
  on(event: string, fn: (...args: never[]) => void, context?: unknown): unknown;
  once(event: string, fn: (...args: never[]) => void, context?: unknown): unknown;
  off(event: string, fn?: (...args: never[]) => void, context?: unknown): unknown;
}

export interface TypedEvents {
  emit<K extends GameEventName>(event: K, ...args: GameEventMap[K]): boolean;
  on<K extends GameEventName>(
    event: K,
    handler: (...args: GameEventMap[K]) => void,
    context?: unknown,
  ): void;
  once<K extends GameEventName>(
    event: K,
    handler: (...args: GameEventMap[K]) => void,
    context?: unknown,
  ): void;
  /** Removes one handler, or every handler for the event when omitted. */
  off<K extends GameEventName>(
    event: K,
    handler?: (...args: GameEventMap[K]) => void,
    context?: unknown,
  ): void;
}

/** Typed view of a scene's own event bus. Structural, so no Phaser import is
 *  needed — `Phaser.Scene` satisfies it. */
export function sceneEvents(scene: { events: EventEmitterLike }): TypedEvents {
  return typedEvents(scene.events);
}

/** Wraps an emitter. The emitter is unchanged, so untyped listeners registered
 *  directly on it still work. */
export function typedEvents(emitter: EventEmitterLike): TypedEvents {
  return {
    emit(event, ...args) {
      return emitter.emit(event, ...args);
    },
    on(event, handler, context) {
      emitter.on(event, handler as (...args: never[]) => void, context);
    },
    once(event, handler, context) {
      emitter.once(event, handler as (...args: never[]) => void, context);
    },
    off(event, handler, context) {
      emitter.off(event, handler as ((...args: never[]) => void) | undefined, context);
    },
  };
}
