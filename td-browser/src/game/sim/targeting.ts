/**
 * Target selection.
 *
 * Which enemy a tower shoots is a real tactical lever, not a detail: "first"
 * pushes damage toward the exit where leaks happen, "last" protects the back of
 * a queue, "strongest" focuses elites, "closest" maximises uptime. Each tower
 * carries its own setting and it can be changed mid-wave.
 */

import type { Vec2 } from "./entities";

export type TargetingPriority = "first" | "last" | "strongest" | "closest";

export const TARGETING_PRIORITIES = [
  "first",
  "last",
  "strongest",
  "closest",
] as const satisfies readonly TargetingPriority[];

/** The default a freshly placed tower uses. Matches the pre-Phase-1 behaviour,
 *  where every tower shot whatever was nearest. */
export const DEFAULT_TARGETING_PRIORITY: TargetingPriority = "closest";

export const TARGETING_LABELS: Readonly<Record<TargetingPriority, string>> = Object.freeze({
  first: "First",
  last: "Last",
  strongest: "Strongest",
  closest: "Closest",
});

/** Cycles through the priorities, for a single-tap UI control. */
export function nextPriority(current: TargetingPriority): TargetingPriority {
  const index = TARGETING_PRIORITIES.indexOf(current);
  return TARGETING_PRIORITIES[(index + 1) % TARGETING_PRIORITIES.length];
}

/** What target selection needs to know about a candidate. */
export interface TargetCandidate {
  id: number;
  position: Vec2;
  health: number;
  /** How far along its route the enemy is. Higher means nearer the exit. */
  pathIndex: number;
  alive: boolean;
  dying: boolean;
  /** Untargetable unless the tower has detection. */
  phased?: boolean;
}

export interface TargetingTower {
  position: Vec2;
  range: number;
  priority: TargetingPriority;
  /** Whether this tower can see phased enemies. */
  detection?: boolean;
}

function distanceBetween(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Whether a tower is allowed to shoot a given enemy at all. */
export function isTargetable(tower: TargetingTower, candidate: TargetCandidate): boolean {
  if (!candidate.alive || candidate.dying) return false;
  // Phasing is a hard gate, not a penalty: without detection the enemy simply
  // is not there as far as this tower is concerned.
  if (candidate.phased && !tower.detection) return false;
  return distanceBetween(tower.position, candidate.position) <= tower.range;
}

/**
 * Picks a target, or null when nothing is eligible.
 *
 * Ties break on lowest id, so the result never depends on iteration order and
 * a simulation stays reproducible.
 */
export function selectTarget(
  tower: TargetingTower,
  candidates: Iterable<TargetCandidate>,
): TargetCandidate | null {
  let best: TargetCandidate | null = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    if (!isTargetable(tower, candidate)) continue;

    const score = scoreFor(tower, candidate);
    if (best === null || score > bestScore || (score === bestScore && candidate.id < best.id)) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}

/** Higher is more desirable. */
function scoreFor(tower: TargetingTower, candidate: TargetCandidate): number {
  switch (tower.priority) {
    case "first":
      return candidate.pathIndex;
    case "last":
      return -candidate.pathIndex;
    case "strongest":
      return candidate.health;
    case "closest":
      return -distanceBetween(tower.position, candidate.position);
  }
}
