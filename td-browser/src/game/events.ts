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

/** How a run finished, for `runEnded`. */
export type RunOutcome = "victory" | "defeat" | "quit";

/**
 * Every event on the bus, with its payload as a tuple.
 *
 * Naming is inconsistent — the five original events are kebab-case and the
 * five new ones are camelCase. The existing names are load-bearing (renaming
 * one silently breaks its listener) and the new names are as specified in the
 * build plan. See NOTES-FOR-HUMAN.md: normalising them is a small, safe change
 * once the phase is signed off.
 */
export interface GameEventMap {
  /** An enemy died. Payload is the gold reward. */
  "enemy-killed": [reward: number];
  /** An enemy reached the exit. Payload is lives lost, already resolved. */
  "enemy-reached-goal": [lifeLoss: number];
  /** Lives hit zero. */
  "game-over": [];
  /** The player picked a tower to place, or cleared the selection. */
  "tower-selected": [towerType: unknown];
  /** A tower was bought. Payload is the price paid. */
  "purchase-tower": [cost: number];

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
}

export type GameEventName = keyof GameEventMap;

/**
 * Every event name, for tests and diagnostics.
 *
 * Kept in step with `GameEventMap` by the `satisfies` clause: adding a key to
 * the map without adding it here is a compile error.
 */
export const GAME_EVENT_NAMES = [
  "enemy-killed",
  "enemy-reached-goal",
  "game-over",
  "tower-selected",
  "purchase-tower",
  "waveStarted",
  "waveCleared",
  "towerPlaced",
  "towerUpgraded",
  "runEnded",
  "enemyEscaped",
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
