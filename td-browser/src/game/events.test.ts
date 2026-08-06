import { describe, expect, it, vi } from "vitest";
import { GAME_EVENT_NAMES, typedEvents } from "./events";
import type { EventEmitterLike } from "./events";

/** Minimal stand-in for Phaser's EventEmitter, so these tests need no scene. */
function fakeEmitter(): EventEmitterLike & { handlers: Map<string, Array<(...a: never[]) => void>> } {
  const handlers = new Map<string, Array<(...a: never[]) => void>>();
  return {
    handlers,
    emit(event: string, ...args: unknown[]): boolean {
      const list = handlers.get(event);
      if (!list?.length) return false;
      for (const fn of [...list]) (fn as (...a: unknown[]) => void)(...args);
      return true;
    },
    on(event: string, fn: (...a: never[]) => void) {
      handlers.set(event, [...(handlers.get(event) ?? []), fn]);
      return this;
    },
    once(event: string, fn: (...a: never[]) => void) {
      const wrapper = (...args: never[]) => {
        this.off(event, wrapper);
        fn(...args);
      };
      return this.on(event, wrapper);
    },
    off(event: string, fn?: (...a: never[]) => void) {
      if (!fn) handlers.delete(event);
      else handlers.set(event, (handlers.get(event) ?? []).filter((h) => h !== fn));
      return this;
    },
  };
}

describe("typedEvents", () => {
  it("delivers a payload from emit to on", () => {
    const events = typedEvents(fakeEmitter());
    const handler = vi.fn();
    events.on("enemy-killed", handler);
    events.emit("enemy-killed", 20);
    expect(handler).toHaveBeenCalledWith(20);
  });

  it("delivers to every listener", () => {
    const events = typedEvents(fakeEmitter());
    const a = vi.fn();
    const b = vi.fn();
    events.on("purchase-tower", a);
    events.on("purchase-tower", b);
    events.emit("purchase-tower", 50);
    expect(a).toHaveBeenCalledWith(50);
    expect(b).toHaveBeenCalledWith(50);
  });

  it("supports events with no payload", () => {
    const events = typedEvents(fakeEmitter());
    const handler = vi.fn();
    events.on("game-over", handler);
    events.emit("game-over");
    expect(handler).toHaveBeenCalledOnce();
  });

  it("delivers multi-argument payloads intact", () => {
    const events = typedEvents(fakeEmitter());
    const handler = vi.fn();
    events.on("towerPlaced", handler);
    events.emit("towerPlaced", "basic", 3, 7);
    expect(handler).toHaveBeenCalledWith("basic", 3, 7);
  });

  describe("once", () => {
    it("fires a handler exactly once", () => {
      const events = typedEvents(fakeEmitter());
      const handler = vi.fn();
      events.once("waveCleared", handler);
      events.emit("waveCleared", 1);
      events.emit("waveCleared", 2);
      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(1);
    });
  });

  describe("off", () => {
    it("removes a specific handler and leaves the others", () => {
      const events = typedEvents(fakeEmitter());
      const kept = vi.fn();
      const removed = vi.fn();
      events.on("enemy-killed", kept);
      events.on("enemy-killed", removed);

      events.off("enemy-killed", removed);
      events.emit("enemy-killed", 5);

      expect(kept).toHaveBeenCalledOnce();
      expect(removed).not.toHaveBeenCalled();
    });

    it("removes every handler for an event when given no handler", () => {
      // GameScene and UIScene both call the bare `off(name)` form on restart to
      // avoid stacking duplicate listeners. That must keep working.
      const events = typedEvents(fakeEmitter());
      const handler = vi.fn();
      events.on("enemy-reached-goal", handler);

      events.off("enemy-reached-goal");
      events.emit("enemy-reached-goal", 3);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  it("wraps the emitter without replacing it", () => {
    // The build plan requires keeping Phaser's own bus, so an untyped listener
    // registered directly on the emitter must still receive typed emits.
    const emitter = fakeEmitter();
    const events = typedEvents(emitter);
    const direct = vi.fn();

    emitter.on("enemy-killed", direct);
    events.emit("enemy-killed", 12);

    expect(direct).toHaveBeenCalledWith(12);
  });
});

describe("GAME_EVENT_NAMES", () => {
  it("preserves every event name the game already used", () => {
    // Renaming any of these would silently break a listener, since Phaser's
    // emitter accepts unknown names without complaint.
    for (const name of [
      "enemy-killed",
      "enemy-reached-goal",
      "game-over",
      "tower-selected",
      "purchase-tower",
    ]) {
      expect(GAME_EVENT_NAMES).toContain(name);
    }
  });

  it("carries an event for each of the three currencies", () => {
    // The definition of done asks for the currencies to move through the typed
    // bus, not through direct calls between scenes.
    for (const name of ["goldChanged", "insigniaChanged", "sealsEarned"]) {
      expect(GAME_EVENT_NAMES).toContain(name);
    }
  });

  it("carries the lieutenant lifecycle", () => {
    for (const name of ["lieutenantSpawned", "lieutenantKilled", "lieutenantEscaped"]) {
      expect(GAME_EVENT_NAMES).toContain(name);
    }
  });

  it("carries power casting and purchasing", () => {
    for (const name of ["powerCast", "powerUnlocked", "commandPurchased"]) {
      expect(GAME_EVENT_NAMES).toContain(name);
    }
  });

  it("adds the events the later phases need", () => {
    for (const name of [
      "waveStarted",
      "waveCleared",
      "towerPlaced",
      "towerUpgraded",
      "runEnded",
    ]) {
      expect(GAME_EVENT_NAMES).toContain(name);
    }
  });

  it("has no duplicates", () => {
    expect(new Set(GAME_EVENT_NAMES).size).toBe(GAME_EVENT_NAMES.length);
  });
});
