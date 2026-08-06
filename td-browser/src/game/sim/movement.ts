/**
 * Path following.
 *
 * Extracted from `BaseEnemy.update()` so a wave's travel timing can be simulated
 * without a scene. The headless harness in Step 0.7 cannot exist without this:
 * knowing whether an enemy leaks means knowing where it is at each tick.
 *
 * Behaviour here is deliberately identical to the original, quirks included —
 * Phase 0 changes nothing visible. The quirks are called out at their sites.
 */

import type { Facing, PathPoint, Vec2 } from "./entities";

/** How close counts as "arrived" at a waypoint, in pixels. */
export const WAYPOINT_ARRIVAL_RADIUS = 2;

/** How close to the first waypoint counts as spawning on top of it. */
const SPAWN_SNAP_RADIUS = 1;

export interface MovementState {
  position: Vec2;
  pathIndex: number;
}

export interface MovementResult {
  position: Vec2;
  pathIndex: number;
  /** True once the path is exhausted — the enemy has leaked. */
  reachedGoal: boolean;
  /**
   * True on the tick the enemy switched to the next waypoint. Such a tick
   * covers no distance, so the view should leave facing and animation alone —
   * the direction reported below is derived from a sub-pixel delta and would
   * make the sprite jitter.
   */
  advancedWaypoint: boolean;
  /** Sprite row to draw. Meaningful only when `advancedWaypoint` is false. */
  direction: Facing;
  /** Travelling right-to-left, so the view can flip the sprite. */
  movingLeft: boolean;
}

/**
 * Which waypoint an enemy spawning at `position` should head for first.
 *
 * An enemy spawned exactly on `path[0]` would otherwise sit at zero distance
 * from its own target and stall.
 */
export function startingPathIndex(position: Vec2, path: readonly PathPoint[]): number {
  if (path.length <= 1) return 0;
  const first = path[0];
  const onFirst =
    Math.abs(first.x - position.x) < SPAWN_SNAP_RADIUS &&
    Math.abs(first.y - position.y) < SPAWN_SNAP_RADIUS;
  return onFirst ? 1 : 0;
}

/**
 * Advances one tick along the path.
 *
 * Pure: returns new values rather than mutating `state`.
 *
 * @param speed Pixels per second.
 * @param deltaMs Milliseconds elapsed this tick.
 */
export function advanceAlongPath(
  state: MovementState,
  path: readonly PathPoint[],
  speed: number,
  deltaMs: number,
): MovementResult {
  const { position, pathIndex } = state;

  if (pathIndex >= path.length) {
    return {
      position,
      pathIndex,
      reachedGoal: true,
      advancedWaypoint: false,
      direction: "down",
      movingLeft: false,
    };
  }

  const target = path[pathIndex];
  const dx = target.x - position.x;
  const dy = target.y - position.y;
  const distance = Math.hypot(dx, dy);

  // Ties fall to "side": the original test is `Math.abs(dy) > Math.abs(dx)`.
  const direction: Facing = Math.abs(dy) > Math.abs(dx) ? (dy > 0 ? "down" : "up") : "side";
  const movingLeft = dx < 0;

  if (distance < WAYPOINT_ARRIVAL_RADIUS) {
    // Quirk preserved: arriving consumes the whole tick. The original's
    // if/else never advances the index and moves in the same frame, and
    // changing that would shift every enemy's arrival time.
    const nextIndex = pathIndex + 1;
    return {
      position,
      pathIndex: nextIndex,
      reachedGoal: nextIndex >= path.length,
      advancedWaypoint: true,
      direction,
      movingLeft,
    };
  }

  // Quirk preserved: no clamping to the waypoint, so a fast enough enemy
  // overshoots and then steers back. At current speeds this is imperceptible.
  const moveDistance = (speed * deltaMs) / 1000;
  return {
    position: {
      x: position.x + (dx / distance) * moveDistance,
      y: position.y + (dy / distance) * moveDistance,
    },
    pathIndex,
    reachedGoal: false,
    advancedWaypoint: false,
    direction,
    movingLeft,
  };
}
