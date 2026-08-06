import { describe, expect, it } from "vitest";
import { SAVE_VERSION, createNewSave, parseSave, serializeSave } from "./saveSchema";
import { LocalSaveStore, MemorySaveStore } from "./SaveStore";
import type { TowerKind } from "../sim/entities";
import type { CommandUpgradeId, TacticalPowerId } from "../data/powers";

describe("createNewSave", () => {
  it("is at the current version", () => {
    expect(createNewSave().version).toBe(SAVE_VERSION);
  });

  it("gives a fresh profile something to build with", () => {
    // A game that opens with no buildable tower is not a game.
    expect(createNewSave().unlockedTowers).toContain("basic");
  });

  it("starts with nothing banked", () => {
    const save = createNewSave();
    expect(save.seals).toBe(0);
    expect(save.lifetimeSeals).toBe(0);
    expect(save.passives).toEqual({});
  });

  it("returns a fresh object each time", () => {
    const a = createNewSave();
    a.seals = 99;
    expect(createNewSave().seals).toBe(0);
  });
});

describe("a round trip preserves everything", () => {
  it("survives serialise and parse", () => {
    const original = {
      ...createNewSave(),
      seals: 42,
      lifetimeSeals: 130,
      unlockedTowers: ["basic", "fast"] as TowerKind[],
      unlockedPowers: ["overcharge"] as TacticalPowerId[],
      unlockedCommands: ["sensorNet"] as CommandUpgradeId[],
      passives: { veteranCrews: 2, warChest: 1 },
      stats: { runsPlayed: 9, bestWave: 23, bossesKilled: 2 },
    };

    const result = parseSave(serializeSave(original));
    expect(result.outcome).toBe("loaded");
    expect(result.save).toEqual(original);
  });
});

describe("★ a bad save never crashes the game", () => {
  // Losing progress is bad. Losing the game is worse. Every one of these must
  // yield a playable profile rather than an exception.
  const bad: Array<[string, string | null]> = [
    ["null", null],
    ["empty string", ""],
    ["whitespace", "   "],
    ["not JSON", "{{{not json at all"],
    ["JSON but a string", '"hello"'],
    ["JSON but a number", "12345"],
    ["JSON but an array", "[1,2,3]"],
    ["JSON null", "null"],
    ["empty object", "{}"],
    ["no version", '{"seals":10}'],
    ["version zero", '{"version":0,"seals":10}'],
    ["negative version", '{"version":-3}'],
    ["version not a number", '{"version":"one"}'],
    ["truncated mid-write", '{"version":1,"seals":10,"unlockedTow'],
    ["nulls everywhere", '{"version":1,"seals":null,"passives":null,"stats":null}'],
    ["wrong types", '{"version":1,"seals":"lots","unlockedTowers":"fast","passives":[1,2]}'],
    ["negative seals", '{"version":1,"seals":-500}'],
    ["infinite seals", '{"version":1,"seals":1e999}'],
    ["NaN seals", '{"version":1,"seals":null}'],
  ];

  it.each(bad)("handles %s without throwing", (_label, raw) => {
    expect(() => parseSave(raw)).not.toThrow();
  });

  it.each(bad)("returns a playable profile for %s", (_label, raw) => {
    const { save } = parseSave(raw);
    expect(save.version).toBe(SAVE_VERSION);
    expect(save.seals).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(save.seals)).toBe(true);
    expect(Array.isArray(save.unlockedTowers)).toBe(true);
    expect(save.unlockedTowers).toContain("basic");
    expect(typeof save.passives).toBe("object");
  });

  it("says what went wrong, so the player can be told", () => {
    const result = parseSave("{{{garbage");
    expect(result.outcome).toBe("recovered");
    expect(result.problem).toBeTruthy();
  });

  it("distinguishes a missing save from a broken one", () => {
    // A first-time player should not be told their progress was lost.
    expect(parseSave(null).outcome).toBe("created");
    expect(parseSave(null).problem).toBeUndefined();
    expect(parseSave("{{{").outcome).toBe("recovered");
  });
});

describe("partial saves keep what is still good", () => {
  it("keeps valid fields when one is corrupt", () => {
    const raw = '{"version":1,"seals":40,"unlockedTowers":"not-an-array","lifetimeSeals":90}';
    const { save } = parseSave(raw);
    expect(save.seals).toBe(40);
    expect(save.lifetimeSeals).toBe(90);
    expect(save.unlockedTowers).toContain("basic"); // fell back
  });

  it("drops nonsense entries from passives rather than the whole record", () => {
    const raw = '{"version":1,"passives":{"veteranCrews":3,"bogus":"x","warChest":-2}}';
    const { save } = parseSave(raw);
    expect(save.passives.veteranCrews).toBe(3);
    expect(save.passives.bogus).toBeUndefined();
    expect(save.passives.warChest).toBeUndefined();
  });

  it("deduplicates repeated unlocks", () => {
    const raw = '{"version":1,"unlockedTowers":["fast","fast","fast"]}';
    expect(parseSave(raw).save.unlockedTowers).toEqual(["fast"]);
  });

  it("floors fractional numbers", () => {
    expect(parseSave('{"version":1,"seals":40.9}').save.seals).toBe(40);
  });
});

describe("versioning", () => {
  it("reports a current-version save as loaded", () => {
    expect(parseSave(serializeSave(createNewSave())).outcome).toBe("loaded");
  });

  it("refuses a save from a newer build rather than misreading it", () => {
    // Down-converting an unknown shape is worse than starting fresh, and the
    // original is left untouched on disk either way.
    const future = JSON.stringify({ version: SAVE_VERSION + 5, seals: 1000 });
    const result = parseSave(future);
    expect(result.outcome).toBe("recovered");
    expect(result.problem).toContain("newer version");
    expect(result.save.seals).toBe(0);
  });

  it("always writes the current version", () => {
    const stale = { ...createNewSave(), version: 0 };
    expect(JSON.parse(serializeSave(stale)).version).toBe(SAVE_VERSION);
  });
});

describe("MemorySaveStore", () => {
  it("creates a profile when empty", () => {
    expect(new MemorySaveStore().load().outcome).toBe("created");
  });

  it("round-trips a save", () => {
    const store = new MemorySaveStore();
    const data = { ...createNewSave(), seals: 77 };
    expect(store.save(data)).toBe(true);
    expect(store.load().save.seals).toBe(77);
  });

  it("clears back to a fresh profile", () => {
    const store = new MemorySaveStore();
    store.save({ ...createNewSave(), seals: 77 });
    store.clear();
    expect(store.load().save.seals).toBe(0);
  });
});

describe("LocalSaveStore without usable storage", () => {
  // Safari private mode, embedded webviews, and portal iframes can all block
  // localStorage. None may take the game down.
  it("degrades to memory instead of throwing", () => {
    const original = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("storage blocked");
      },
    });

    try {
      const store = new LocalSaveStore();
      expect(store.isAvailable()).toBe(false);

      // Still usable within the session, just not persistent.
      expect(() => store.save({ ...createNewSave(), seals: 5 })).not.toThrow();
      expect(store.load().save.seals).toBe(5);
      expect(() => store.clear()).not.toThrow();
    } finally {
      if (original === undefined) {
        delete (globalThis as { localStorage?: unknown }).localStorage;
      } else {
        Object.defineProperty(globalThis, "localStorage", {
          configurable: true,
          value: original,
        });
      }
    }
  });
});

describe("migrating a version 1 save", () => {
  // The first real migration. Until now the machinery existed but had never
  // carried anything, which is the worst possible state to discover a bug in.
  const v1 = JSON.stringify({
    version: 1,
    seals: 40,
    lifetimeSeals: 120,
    unlockedTowers: ["basic", "fast"],
    unlockedPowers: ["overcharge"],
    unlockedCommands: [],
    passives: { veteranCrews: 2 },
    stats: { runsPlayed: 5, bestWave: 12, bossesKilled: 1 },
  });

  it("reports that it migrated rather than loaded", () => {
    expect(parseSave(v1).outcome).toBe("migrated");
  });

  it("keeps everything the old save had", () => {
    const { save } = parseSave(v1);
    expect(save.seals).toBe(40);
    expect(save.lifetimeSeals).toBe(120);
    expect(save.unlockedTowers).toEqual(["basic", "fast"]);
    expect(save.unlockedPowers).toEqual(["overcharge"]);
    expect(save.passives).toEqual({ veteranCrews: 2 });
    expect(save.stats).toEqual({ runsPlayed: 5, bestWave: 12, bossesKilled: 1 });
  });

  it("adds the new field with a safe default", () => {
    // Unmuted is the safe direction: a returning player hearing sound they can
    // turn off is a smaller surprise than one who thinks audio is broken.
    expect(parseSave(v1).save.muted).toBe(false);
  });

  it("stamps the current version", () => {
    expect(parseSave(v1).save.version).toBe(SAVE_VERSION);
  });

  it("does not lose progress, which is the whole point", () => {
    const migrated = parseSave(v1).save;
    const reloaded = parseSave(serializeSave(migrated));
    expect(reloaded.outcome).toBe("loaded");
    expect(reloaded.save).toEqual(migrated);
  });
});

describe("mute persists", () => {
  it("round-trips through a save", () => {
    const muted = { ...createNewSave(), muted: true };
    expect(parseSave(serializeSave(muted)).save.muted).toBe(true);
  });

  it("defaults to unmuted when the field is absent or nonsense", () => {
    expect(parseSave('{"version":2}').save.muted).toBe(false);
    expect(parseSave('{"version":2,"muted":"yes"}').save.muted).toBe(false);
  });
});
