/**
 * Enemy construction.
 *
 * One factory used by both the live game and the headless harness, so a
 * simulated enemy and a rendered one are the same enemy. Duplicating this would
 * let balance results drift from what the player actually faces.
 */

import { getEnemyDef, scaledHealth, scaledSpeed } from "../data/enemies";
import { applyProperties } from "./properties";
import { startingPathIndex } from "./movement";
import type { EnemyProperty } from "./properties";
import { costsLivesOnLeak } from "./lieutenants";
import type { EnemyRole } from "./lieutenants";
import type { EnemyKind, EnemyState, PathPoint, Vec2 } from "./entities";

/**
 * Generations past which a splitter's children stop splitting.
 *
 * Without this a splitting enemy is exponential and a single leak can hang the
 * simulation.
 */
export const MAX_SPLIT_GENERATION = 1;

export interface SpawnRequest {
  id: number;
  kind: EnemyKind;
  position: Vec2;
  path: readonly PathPoint[];
  wave: number;
  speedModifier?: number;
  healthModifier?: number;
  properties?: readonly EnemyProperty[];
  /** 0 for a wave spawn; 1 for a splitter's child. */
  generation?: number;
  /** Overrides the health the definition would give, for split children. */
  healthOverride?: number;
  /** Starts the enemy partway along the route, for children of a splitter. */
  pathIndexOverride?: number;
  /** Ordinary enemy, lieutenant, or boss. Defaults to ordinary. */
  role?: EnemyRole;
  /** Multiplies the health the definition would give. Lieutenants are tanky. */
  healthMultiplier?: number;
  /** Multiplies base speed, before properties. Lieutenants are slow. */
  extraSpeedMultiplier?: number;
  /** Multiplies the gold reward. */
  goldMultiplier?: number;
  /** Insignia paid on death. Lieutenants and bosses only. */
  insigniaReward?: number;
}

export function createEnemyState(request: SpawnRequest): EnemyState {
  const {
    id,
    kind,
    position,
    path,
    wave,
    speedModifier = 1,
    healthModifier = 1,
    properties = [],
    generation = 0,
    role = "normal",
    healthMultiplier = 1,
    extraSpeedMultiplier = 1,
    goldMultiplier = 1,
    insigniaReward = 0,
  } = request;

  const def = getEnemyDef(kind);

  const stats = applyProperties(
    {
      armor: 0,
      shield: 0,
      speed: scaledSpeed(kind, speedModifier) * extraSpeedMultiplier,
      phased: false,
      splitsInto: null,
    },
    properties,
    kind,
  );

  const health =
    request.healthOverride !== undefined
      ? Math.max(1, Math.round(request.healthOverride))
      : Math.max(1, Math.round(scaledHealth(kind, healthModifier) * healthMultiplier));

  return {
    id,
    kind,
    position: { x: position.x, y: position.y },
    pathIndex: request.pathIndexOverride ?? startingPathIndex(position, path),
    health,
    maxHealth: health,
    speed: stats.speed,
    reward: Math.round(def.reward * goldMultiplier),
    lifeLoss: def.lifeLoss,
    wave,
    alive: true,
    dying: false,

    properties: [...properties],
    armor: stats.armor,
    shield: stats.shield,
    phased: stats.phased,
    // Children of a splitter do not split again.
    splitsInto: generation >= MAX_SPLIT_GENERATION ? null : stats.splitsInto,
    slowedUntilMs: 0,
    slowFactor: 1,
    generation,

    role,
    insigniaReward,
    // Lieutenants leave with their prize and nothing else. This is the rule the
    // whole mechanic rests on — see sim/lieutenants.ts.
    exemptFromLifeLoss: !costsLivesOnLeak(role),
  };
}

/**
 * The enemies a splitter leaves behind.
 *
 * Children appear where the parent died and continue from its position on the
 * route, so splitting buys the player no ground — it costs them time.
 */
export function createSplitChildren(
  parent: EnemyState,
  nextId: () => number,
  path: readonly PathPoint[],
): EnemyState[] {
  const split = parent.splitsInto;
  if (!split) return [];

  // Children inherit everything except splitting itself, so an armoured
  // splitter produces armoured children.
  const inherited = parent.properties.filter((p) => p !== "splitter");

  return Array.from({ length: split.count }, () =>
    createEnemyState({
      id: nextId(),
      kind: split.kind,
      position: parent.position,
      path,
      wave: parent.wave,
      properties: inherited,
      generation: parent.generation + 1,
      // Children are ordinary enemies: a lieutenant's death must not spawn
      // two more life-exempt, Insignia-bearing targets.
      role: "normal",
      healthOverride: parent.maxHealth * split.healthFraction,
      pathIndexOverride: parent.pathIndex,
    }),
  );
}
