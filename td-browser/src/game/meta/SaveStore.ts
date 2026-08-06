/**
 * Where a save lives.
 *
 * The interface is the point. Progression persists to localStorage today —
 * portal-ready, offline, no login, no backend cost — but nothing above this
 * line knows that. A Cloudflare D1 implementation can be added later without
 * touching the schema, the migrations, or any caller.
 *
 * Deliberately synchronous. localStorage is, and making the interface async
 * for a backend that does not exist yet would put promises through every
 * caller for no present benefit. When D1 arrives it brings a second, async
 * interface and a sync layer between them — which is the honest shape of that
 * problem rather than a pretence that it is already solved.
 */

import { SAVE_KEY, createNewSave, parseSave, serializeSave } from "./saveSchema";
import type { LoadResult, SaveData } from "./saveSchema";

export interface SaveStore {
  load(): LoadResult;
  save(data: SaveData): boolean;
  clear(): void;
  /** Whether this store can actually persist. False in private-mode browsers. */
  isAvailable(): boolean;
}

/**
 * Backed by localStorage.
 *
 * Every access is wrapped: Safari private mode throws on `setItem`, some
 * embedded webviews throw on merely reading `localStorage`, and a portal iframe
 * may block storage entirely. None of those may take the game down, so the
 * store degrades to in-memory and the player gets a session that works but
 * does not persist.
 */
export class LocalSaveStore implements SaveStore {
  private memoryFallback: SaveData | null = null;
  private storageWorks: boolean;

  constructor() {
    this.storageWorks = LocalSaveStore.probe();
  }

  /** Detects whether localStorage is usable, without assuming it exists. */
  private static probe(): boolean {
    try {
      const key = "__td_probe__";
      globalThis.localStorage?.setItem(key, "1");
      globalThis.localStorage?.removeItem(key);
      return typeof globalThis.localStorage !== "undefined";
    } catch {
      return false;
    }
  }

  isAvailable(): boolean {
    return this.storageWorks;
  }

  load(): LoadResult {
    if (!this.storageWorks) {
      return this.memoryFallback
        ? { save: this.memoryFallback, outcome: "loaded" }
        : {
            save: createNewSave(),
            outcome: "created",
            problem: "Storage is unavailable; progress will not persist.",
          };
    }

    let raw: string | null = null;
    try {
      raw = globalThis.localStorage.getItem(SAVE_KEY);
    } catch {
      return {
        save: createNewSave(),
        outcome: "recovered",
        problem: "Storage could not be read; progress will not persist.",
      };
    }

    return parseSave(raw);
  }

  save(data: SaveData): boolean {
    // Kept in memory regardless, so a session with blocked storage still
    // behaves consistently within itself.
    this.memoryFallback = data;

    if (!this.storageWorks) return false;

    try {
      globalThis.localStorage.setItem(SAVE_KEY, serializeSave(data));
      return true;
    } catch {
      // Quota exceeded, or storage revoked mid-session. Downgrade rather than
      // throwing at whatever was mid-frame.
      this.storageWorks = false;
      return false;
    }
  }

  clear(): void {
    this.memoryFallback = null;
    if (!this.storageWorks) return;
    try {
      globalThis.localStorage.removeItem(SAVE_KEY);
    } catch {
      // Nothing useful to do; the next save will downgrade.
    }
  }
}

/** In-memory store, for tests and for sessions where storage is unavailable. */
export class MemorySaveStore implements SaveStore {
  private data: SaveData | null = null;

  isAvailable(): boolean {
    return true;
  }

  load(): LoadResult {
    return this.data
      ? { save: this.data, outcome: "loaded" }
      : { save: createNewSave(), outcome: "created" };
  }

  save(data: SaveData): boolean {
    this.data = data;
    return true;
  }

  clear(): void {
    this.data = null;
  }
}
