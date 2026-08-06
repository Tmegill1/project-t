import { describe, expect, it } from "vitest";
import { createRng } from "./rng";

describe("createRng", () => {
  it("produces identical streams for identical seeds", () => {
    const a = createRng(12345);
    const b = createRng(12345);
    const drawA = Array.from({ length: 50 }, () => a.next());
    const drawB = Array.from({ length: 50 }, () => b.next());
    expect(drawA).toEqual(drawB);
  });

  it("produces different streams for different seeds", () => {
    const a = Array.from({ length: 20 }, (_, i) => createRng(1).next() + i * 0);
    const b = Array.from({ length: 20 }, (_, i) => createRng(2).next() + i * 0);
    expect(a[0]).not.toBe(b[0]);
  });

  it("yields values in [0, 1)", () => {
    const rng = createRng(99);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("advances state on each call", () => {
    const rng = createRng(7);
    const first = rng.next();
    const second = rng.next();
    expect(first).not.toBe(second);
  });

  describe("int", () => {
    it("stays within the inclusive range", () => {
      const rng = createRng(4);
      for (let i = 0; i < 500; i++) {
        const v = rng.int(3, 7);
        expect(v).toBeGreaterThanOrEqual(3);
        expect(v).toBeLessThanOrEqual(7);
        expect(Number.isInteger(v)).toBe(true);
      }
    });

    it("returns the bound when min equals max", () => {
      const rng = createRng(4);
      expect(rng.int(5, 5)).toBe(5);
    });

    it("covers both endpoints over enough draws", () => {
      const rng = createRng(11);
      const seen = new Set<number>();
      for (let i = 0; i < 500; i++) seen.add(rng.int(0, 2));
      expect([...seen].sort()).toEqual([0, 1, 2]);
    });
  });

  describe("pick", () => {
    it("returns an element of the array", () => {
      const rng = createRng(21);
      const items = ["a", "b", "c"] as const;
      for (let i = 0; i < 100; i++) {
        expect(items).toContain(rng.pick(items));
      }
    });

    it("is deterministic for a given seed", () => {
      const items = ["a", "b", "c", "d"];
      const first = Array.from({ length: 10 }, () => createRng(3).pick(items));
      expect(new Set(first).size).toBe(1);
    });

    it("throws on an empty array rather than returning undefined", () => {
      const rng = createRng(1);
      expect(() => rng.pick([])).toThrow();
    });
  });

  describe("shuffle", () => {
    it("preserves the multiset of elements", () => {
      const rng = createRng(8);
      const input = [1, 2, 3, 4, 5, 6, 7, 8];
      const out = rng.shuffle(input);
      expect([...out].sort((x, y) => x - y)).toEqual(input);
    });

    it("does not mutate its input", () => {
      const rng = createRng(8);
      const input = [1, 2, 3, 4, 5];
      const copy = [...input];
      rng.shuffle(input);
      expect(input).toEqual(copy);
    });

    it("is deterministic for a given seed", () => {
      const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      expect(createRng(42).shuffle(input)).toEqual(createRng(42).shuffle(input));
    });

    it("actually reorders", () => {
      const input = Array.from({ length: 20 }, (_, i) => i);
      expect(createRng(5).shuffle(input)).not.toEqual(input);
    });
  });

  describe("fork", () => {
    it("gives a stream whose draws do not disturb the parent", () => {
      // A fork is seeded from the parent, so creating one necessarily consumes
      // one parent draw. The property that matters is the one after that: how
      // much the child draws must not change what the parent produces next.
      // Otherwise adding a subsystem would silently shift every other stream.
      const heavy = createRng(100);
      const heavyChild = heavy.fork();
      for (let i = 0; i < 100; i++) heavyChild.next();

      const light = createRng(100);
      light.fork();

      expect(heavy.next()).toBe(light.next());
    });

    it("diverges from the parent's own stream", () => {
      const parent = createRng(100);
      const child = parent.fork();
      expect(child.next()).not.toBe(parent.next());
    });

    it("is deterministic across identical seeds", () => {
      const a = createRng(77);
      const b = createRng(77);
      expect(a.fork().next()).toBe(b.fork().next());
    });
  });
});
