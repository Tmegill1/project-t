import { describe, expect, it } from "vitest";
import { WAYPOINT_ARRIVAL_RADIUS, advanceAlongPath, startingPathIndex } from "./movement";
import type { PathPoint } from "./entities";

const STRAIGHT: PathPoint[] = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 200, y: 0 },
];

describe("startingPathIndex", () => {
  // BaseEnemy skips the first waypoint when it spawns on top of it, otherwise
  // enemies can stall on their own spawn tile.
  it("starts at the second waypoint when spawned on the first", () => {
    expect(startingPathIndex({ x: 0, y: 0 }, STRAIGHT)).toBe(1);
  });

  it("tolerates sub-pixel spawn offsets", () => {
    expect(startingPathIndex({ x: 0.5, y: 0.5 }, STRAIGHT)).toBe(1);
  });

  it("starts at the first waypoint when spawned away from it", () => {
    expect(startingPathIndex({ x: 50, y: 0 }, STRAIGHT)).toBe(0);
  });

  it("starts at the first waypoint for a single-point path", () => {
    expect(startingPathIndex({ x: 0, y: 0 }, [{ x: 0, y: 0 }])).toBe(0);
  });

  it("starts at the first waypoint for an empty path", () => {
    expect(startingPathIndex({ x: 0, y: 0 }, [])).toBe(0);
  });
});

describe("advanceAlongPath", () => {
  it("moves toward the current waypoint at speed x time", () => {
    // 100 px/s for 100 ms = 10 px.
    const result = advanceAlongPath(
      { position: { x: 0, y: 0 }, pathIndex: 1 },
      STRAIGHT,
      100,
      100,
    );
    expect(result.position.x).toBeCloseTo(10);
    expect(result.position.y).toBeCloseTo(0);
    expect(result.reachedGoal).toBe(false);
  });

  it("moves diagonally along the unit vector to the waypoint", () => {
    const diagonal: PathPoint[] = [{ x: 0, y: 0 }, { x: 30, y: 40 }];
    const result = advanceAlongPath(
      { position: { x: 0, y: 0 }, pathIndex: 1 },
      diagonal,
      50,
      1000,
    );
    // Distance to waypoint is 50; one second at 50 px/s covers exactly that.
    expect(result.position.x).toBeCloseTo(30);
    expect(result.position.y).toBeCloseTo(40);
  });

  it("scales movement with delta", () => {
    const slow = advanceAlongPath({ position: { x: 0, y: 0 }, pathIndex: 1 }, STRAIGHT, 100, 16);
    const fast = advanceAlongPath({ position: { x: 0, y: 0 }, pathIndex: 1 }, STRAIGHT, 100, 32);
    expect(fast.position.x).toBeCloseTo(slow.position.x * 2);
  });

  it("is pure — it does not mutate the state passed in", () => {
    const state = { position: { x: 0, y: 0 }, pathIndex: 1 };
    advanceAlongPath(state, STRAIGHT, 100, 100);
    expect(state.position).toEqual({ x: 0, y: 0 });
    expect(state.pathIndex).toBe(1);
  });

  describe("waypoint arrival", () => {
    it("advances the index once inside the arrival radius", () => {
      const result = advanceAlongPath(
        { position: { x: 99.5, y: 0 }, pathIndex: 1 },
        STRAIGHT,
        100,
        16,
      );
      expect(result.pathIndex).toBe(2);
    });

    it("does not move on the frame it switches waypoints", () => {
      // BaseEnemy's if/else means arrival and movement never happen in the same
      // frame. Preserving this keeps travel timing bit-identical.
      const start = { x: 99.5, y: 0 };
      const result = advanceAlongPath({ position: start, pathIndex: 1 }, STRAIGHT, 100, 16);
      expect(result.position).toEqual(start);
    });

    it("uses a 2px arrival radius", () => {
      expect(WAYPOINT_ARRIVAL_RADIUS).toBe(2);

      const justOutside = advanceAlongPath(
        { position: { x: 98, y: 0 }, pathIndex: 1 },
        STRAIGHT,
        100,
        16,
      );
      expect(justOutside.pathIndex).toBe(1);

      const justInside = advanceAlongPath(
        { position: { x: 98.5, y: 0 }, pathIndex: 1 },
        STRAIGHT,
        100,
        16,
      );
      expect(justInside.pathIndex).toBe(2);
    });

    it("may overshoot a waypoint at high speed, as the original does", () => {
      const result = advanceAlongPath(
        { position: { x: 0, y: 0 }, pathIndex: 1 },
        STRAIGHT,
        10000,
        100,
      );
      expect(result.position.x).toBeGreaterThan(100);
      expect(result.pathIndex).toBe(1);
    });
  });

  describe("reaching the goal", () => {
    it("reports the goal when the index runs past the last waypoint", () => {
      const result = advanceAlongPath(
        { position: { x: 200, y: 0 }, pathIndex: 2 },
        STRAIGHT,
        100,
        16,
      );
      expect(result.reachedGoal).toBe(true);
      expect(result.pathIndex).toBe(3);
    });

    it("reports the goal immediately when the index is already past the end", () => {
      const result = advanceAlongPath(
        { position: { x: 200, y: 0 }, pathIndex: 3 },
        STRAIGHT,
        100,
        16,
      );
      expect(result.reachedGoal).toBe(true);
    });

    it("reports the goal for an empty path instead of stalling", () => {
      const result = advanceAlongPath({ position: { x: 0, y: 0 }, pathIndex: 0 }, [], 100, 16);
      expect(result.reachedGoal).toBe(true);
    });
  });

  describe("facing direction", () => {
    it("faces along the dominant axis of travel", () => {
      const down: PathPoint[] = [{ x: 0, y: 0 }, { x: 0, y: 100 }];
      const up: PathPoint[] = [{ x: 0, y: 100 }, { x: 0, y: 0 }];
      expect(
        advanceAlongPath({ position: { x: 0, y: 0 }, pathIndex: 1 }, down, 100, 16).direction,
      ).toBe("down");
      expect(
        advanceAlongPath({ position: { x: 0, y: 100 }, pathIndex: 1 }, up, 100, 16).direction,
      ).toBe("up");
      expect(
        advanceAlongPath({ position: { x: 0, y: 0 }, pathIndex: 1 }, STRAIGHT, 100, 16).direction,
      ).toBe("side");
    });

    it("prefers horizontal on an exact diagonal, matching the original", () => {
      // BaseEnemy's test is `Math.abs(dy) > Math.abs(dx)`, so ties fall to "side".
      const diagonal: PathPoint[] = [{ x: 0, y: 0 }, { x: 50, y: 50 }];
      expect(
        advanceAlongPath({ position: { x: 0, y: 0 }, pathIndex: 1 }, diagonal, 100, 16).direction,
      ).toBe("side");
    });

    it("reports leftward travel so the view can flip the sprite", () => {
      const leftward: PathPoint[] = [{ x: 100, y: 0 }, { x: 0, y: 0 }];
      const result = advanceAlongPath(
        { position: { x: 100, y: 0 }, pathIndex: 1 },
        leftward,
        100,
        16,
      );
      expect(result.movingLeft).toBe(true);
    });
  });
});
