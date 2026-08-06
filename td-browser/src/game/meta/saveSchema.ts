/**
 * The persisted save, its version, and how older versions become current.
 *
 * Two rules govern everything here:
 *
 * 1. **A save that cannot be understood must never crash the game.** A player
 *    with a corrupted or half-written save should get a fresh profile and a
 *    playable game, not a black screen. Losing progress is bad; losing the
 *    game is worse.
 * 2. **Every schema change bumps the version and adds a migration.** The
 *    alternative is silently misreading old data, which is worse than
 *    rejecting it.
 *
 * Storage is localStorage today. Nothing in this file knows that — see
 * `SaveStore` — so a Cloudflare D1 backend can be added later without
 * touching the schema or the migrations.
 */

import type { CommandUpgradeId, TacticalPowerId } from "../data/powers";
import type { TowerKind } from "../sim/entities";

/**
 * Current schema version.
 *
 * Bump this and add a migration whenever the shape changes.
 */
export const SAVE_VERSION = 2;

export const SAVE_KEY = "td-browser.profile.v1";

/** What the player has permanently earned and bought. */
export interface SaveData {
  version: number;
  /** Seals banked and not yet spent. */
  seals: number;
  /** Seals earned across every run, for display. Never decreases. */
  lifetimeSeals: number;
  /** Towers unlocked for use in a run. */
  unlockedTowers: TowerKind[];
  /** Tactical powers available to buy during a run. */
  unlockedPowers: TacticalPowerId[];
  /** Command upgrades available to buy during a run. */
  unlockedCommands: CommandUpgradeId[];
  /** Permanent passive upgrades, by id, with the tier bought. */
  passives: Record<string, number>;
  stats: SaveStats;
  /** Whether the player has silenced the game. Added in version 2. */
  muted: boolean;
}

export interface SaveStats {
  runsPlayed: number;
  bestWave: number;
  bossesKilled: number;
}

/**
 * A brand-new profile.
 *
 * Every tower is unlocked from the start. Gating them behind Seals meant a new
 * player opened the build menu and found a single option, which reads as a
 * broken game rather than as progression. Seals buy powers, command upgrades
 * and passives instead — things a player can miss without wondering whether
 * the game is working.
 */
export function createNewSave(): SaveData {
  return {
    version: SAVE_VERSION,
    seals: 0,
    lifetimeSeals: 0,
    unlockedTowers: ["basic", "fast", "long", "mortar"],
    unlockedPowers: [],
    unlockedCommands: [],
    passives: {},
    stats: { runsPlayed: 0, bestWave: 0, bossesKilled: 0 },
    muted: false,
  };
}

/** A migration from one version to the next. */
type Migration = (save: Record<string, unknown>) => Record<string, unknown>;

/**
 * Migrations, keyed by the version they upgrade *from*.
 *
 * Each takes a save at that version and returns one at the next. They run in
 * sequence, so a version 1 save reaches the current version by passing through
 * every step rather than needing a direct path.
 */
const MIGRATIONS: Readonly<Record<number, Migration>> = Object.freeze({
  /**
   * 1 -> 2: audio arrived, and mute has to survive a reload.
   *
   * Defaulting to unmuted is the safe direction — a returning player hearing
   * sound they can turn off is a smaller surprise than one who thinks the
   * audio is broken.
   */
  1: (save) => ({ ...save, muted: false, version: 2 }),
});

export interface LoadResult {
  save: SaveData;
  /** How the save was obtained, so callers can tell the player. */
  outcome: "loaded" | "migrated" | "created" | "recovered";
  /** Set when something was wrong, for logging and the UI. */
  problem?: string;
}

/**
 * Turns whatever was in storage into a usable save.
 *
 * Never throws and never returns null. Anything unreadable produces a fresh
 * profile with `outcome: "recovered"` and the reason, so the caller can tell
 * the player their progress could not be read rather than silently resetting.
 */
export function parseSave(raw: string | null): LoadResult {
  if (raw === null || raw.trim() === "") {
    return { save: createNewSave(), outcome: "created" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      save: createNewSave(),
      outcome: "recovered",
      problem: "Save file was not valid JSON.",
    };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {
      save: createNewSave(),
      outcome: "recovered",
      problem: "Save file was not an object.",
    };
  }

  const record = parsed as Record<string, unknown>;
  const version = typeof record.version === "number" ? record.version : NaN;

  if (!Number.isFinite(version) || version < 1) {
    return {
      save: createNewSave(),
      outcome: "recovered",
      problem: "Save file had no usable version.",
    };
  }

  // A save from a *newer* build cannot be safely down-converted. Refusing is
  // better than misreading it — and the original is left untouched on disk.
  if (version > SAVE_VERSION) {
    return {
      save: createNewSave(),
      outcome: "recovered",
      problem: `Save is from a newer version (${version}); this build understands ${SAVE_VERSION}.`,
    };
  }

  let working = record;
  let currentVersion = version;
  while (currentVersion < SAVE_VERSION) {
    const migrate = MIGRATIONS[currentVersion];
    if (!migrate) {
      return {
        save: createNewSave(),
        outcome: "recovered",
        problem: `No migration from version ${currentVersion}.`,
      };
    }
    working = migrate(working);
    currentVersion++;
  }

  return {
    save: coerce(working),
    outcome: version === SAVE_VERSION ? "loaded" : "migrated",
  };
}

/**
 * Forces a parsed object into a valid SaveData, field by field.
 *
 * Deliberately total: a save with one bad field keeps everything else rather
 * than being thrown away. Hand-edited and partially-written saves are the
 * common case, not the exotic one.
 */
function coerce(record: Record<string, unknown>): SaveData {
  const fallback = createNewSave();

  return {
    version: SAVE_VERSION,
    seals: nonNegativeInt(record.seals, fallback.seals),
    lifetimeSeals: nonNegativeInt(record.lifetimeSeals, fallback.lifetimeSeals),
    unlockedTowers: stringArray(record.unlockedTowers, fallback.unlockedTowers) as TowerKind[],
    unlockedPowers: stringArray(record.unlockedPowers, []) as TacticalPowerId[],
    unlockedCommands: stringArray(record.unlockedCommands, []) as CommandUpgradeId[],
    passives: numberRecord(record.passives),
    stats: coerceStats(record.stats),
    muted: record.muted === true,
  };
}

function coerceStats(value: unknown): SaveStats {
  const stats = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  return {
    runsPlayed: nonNegativeInt(stats.runsPlayed, 0),
    bestWave: nonNegativeInt(stats.bestWave, 0),
    bossesKilled: nonNegativeInt(stats.bossesKilled, 0),
  };
}

function nonNegativeInt(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return fallback;
  return Math.floor(value);
}

function stringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return [...fallback];
  const strings = value.filter((entry): entry is string => typeof entry === "string");
  // Deduplicated: a repeated unlock in a hand-edited save must not double
  // anything downstream.
  return [...new Set(strings)];
}

function numberRecord(value: unknown): Record<string, number> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};

  const out: Record<string, number> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === "number" && Number.isFinite(entry) && entry > 0) {
      out[key] = Math.floor(entry);
    }
  }
  return out;
}

/** Serialises for storage. */
export function serializeSave(save: SaveData): string {
  return JSON.stringify({ ...save, version: SAVE_VERSION });
}
