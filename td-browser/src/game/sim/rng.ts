/**
 * Seeded pseudo-random number generation.
 *
 * All randomness in game logic must go through this module. Bare `Math.random()`
 * makes a run impossible to reproduce, which would defeat the headless harness:
 * "same seed, same result" is what lets a balance regression be diagnosed rather
 * than merely observed.
 *
 * The algorithm is mulberry32 — a small, fast, well-distributed 32-bit PRNG.
 * It is not cryptographically secure and is not meant to be.
 */

export interface Rng {
  /** Next value in [0, 1). */
  next(): number;
  /** Integer in [min, max], both inclusive. */
  int(min: number, max: number): number;
  /** A uniformly chosen element. Throws on an empty array. */
  pick<T>(items: readonly T[]): T;
  /** A shuffled copy. Does not mutate the input. */
  shuffle<T>(items: readonly T[]): T[];
  /**
   * An independent generator seeded from this one's stream.
   *
   * Forking lets a subsystem draw freely without shifting anyone else's
   * sequence, so adding (say) splitter-spawn jitter cannot silently change
   * where map decorations land.
   */
  fork(): Rng;
}

export function createRng(seed: number): Rng {
  // Coerce to a 32-bit unsigned integer so any finite seed is usable.
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const rng: Rng = {
    next,

    int(min: number, max: number): number {
      if (max < min) [min, max] = [max, min];
      const lo = Math.ceil(min);
      const hi = Math.floor(max);
      return lo + Math.floor(next() * (hi - lo + 1));
    },

    pick<T>(items: readonly T[]): T {
      if (items.length === 0) {
        throw new Error("Rng.pick: cannot choose from an empty array");
      }
      return items[Math.floor(next() * items.length)];
    },

    shuffle<T>(items: readonly T[]): T[] {
      // Fisher-Yates. Note that `[...items].sort(() => rng.next() - 0.5)` —
      // the idiom used elsewhere in this codebase — is not a uniform shuffle
      // and its output depends on the engine's sort implementation.
      const out = [...items];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },

    fork(): Rng {
      return createRng(Math.floor(next() * 4294967296));
    },
  };

  return rng;
}
