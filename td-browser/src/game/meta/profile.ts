/**
 * The player's profile, loaded once and shared by every scene.
 *
 * A module-level singleton rather than something threaded through scene data:
 * Phaser scenes are constructed by the framework and restarted freely, so
 * passing a profile between them would mean re-plumbing it at every
 * `scene.start`. One owner, loaded on first use.
 */

import { LocalSaveStore } from "./SaveStore";
import { bankRun } from "../sim/metaProgression";
import type { SaveStore } from "./SaveStore";
import type { LoadResult, SaveData } from "./saveSchema";
import type { RunOutcome } from "../sim/metaProgression";

let store: SaveStore = new LocalSaveStore();
let cached: SaveData | null = null;
let lastLoad: LoadResult | null = null;

/** Swaps the backing store. For tests, and for a future D1-backed store. */
export function setSaveStore(next: SaveStore) {
  store = next;
  cached = null;
  lastLoad = null;
}

/** The current profile, loading it on first use. */
export function getProfile(): SaveData {
  if (cached === null) {
    lastLoad = store.load();
    cached = lastLoad.save;
  }
  return cached;
}

/**
 * How the profile was obtained.
 *
 * Lets the UI tell a player their save could not be read, rather than silently
 * showing them an empty profile and letting them assume they lost everything
 * to a bug.
 */
export function getLoadResult(): LoadResult {
  getProfile();
  return lastLoad!;
}

/** Replaces and persists the profile. Returns false if it could not be stored. */
export function saveProfile(next: SaveData): boolean {
  cached = next;
  return store.save(next);
}

/** Whether progress will actually survive the session. */
export function isPersistent(): boolean {
  return store.isAvailable();
}

/** Folds a finished run into the profile and persists it. */
export function bankRunResult(outcome: RunOutcome): SaveData {
  const next = bankRun(getProfile(), outcome);
  saveProfile(next);
  return next;
}

/** Wipes the profile. Used by a reset control, not by ordinary play. */
export function resetProfile() {
  store.clear();
  cached = null;
  lastLoad = null;
}
