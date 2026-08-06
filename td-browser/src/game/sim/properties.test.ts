import { describe, expect, it } from "vitest";
import {
  ENEMY_PROPERTIES,
  applyProperties,
  describeProperties,
  hasProperty,
} from "./properties";
import type { EnemyProperty } from "./properties";

describe("ENEMY_PROPERTIES", () => {
  it("lists the five properties the design calls for", () => {
    expect([...ENEMY_PROPERTIES].sort()).toEqual([
      "armored",
      "phased",
      "shielded",
      "splitter",
      "swift",
    ]);
  });
});

describe("applyProperties", () => {
  const base = { armor: 0, shield: 0, speed: 100, phased: false, splitsInto: null };

  it("leaves a plain enemy untouched", () => {
    expect(applyProperties(base, [])).toEqual(base);
  });

  it("gives armour a flat per-hit reduction", () => {
    const armored = applyProperties(base, ["armored"]);
    expect(armored.armor).toBeGreaterThan(0);
    expect(armored.shield).toBe(0);
  });

  it("gives shields a finite number of absorbed hits", () => {
    const shielded = applyProperties(base, ["shielded"]);
    expect(shielded.shield).toBeGreaterThan(0);
    expect(shielded.armor).toBe(0);
  });

  it("makes swift enemies faster", () => {
    expect(applyProperties(base, ["swift"]).speed).toBeGreaterThan(base.speed);
  });

  it("makes phased enemies phased", () => {
    expect(applyProperties(base, ["phased"]).phased).toBe(true);
  });

  it("gives splitters something to split into", () => {
    const splitter = applyProperties(base, ["splitter"]);
    expect(splitter.splitsInto).not.toBeNull();
    expect(splitter.splitsInto?.count).toBe(2);
  });

  describe("composability", () => {
    // The design requires these to stack freely: a swift armoured splitter is
    // a legal enemy, and each property must still do its own job.
    it("applies every property in a combination", () => {
      const combined = applyProperties(base, ["armored", "shielded", "swift", "phased"]);
      expect(combined.armor).toBeGreaterThan(0);
      expect(combined.shield).toBeGreaterThan(0);
      expect(combined.speed).toBeGreaterThan(base.speed);
      expect(combined.phased).toBe(true);
    });

    it("gives the same result regardless of order", () => {
      const forward = applyProperties(base, ["armored", "swift", "splitter"]);
      const backward = applyProperties(base, ["splitter", "swift", "armored"]);
      expect(forward).toEqual(backward);
    });

    it("does not double-apply a repeated property", () => {
      const once = applyProperties(base, ["swift"]);
      const twice = applyProperties(base, ["swift", "swift"]);
      expect(twice).toEqual(once);
    });

    it("is pure — it does not mutate the base stats", () => {
      const snapshot = { ...base };
      applyProperties(base, ["armored", "swift"]);
      expect(base).toEqual(snapshot);
    });

    it("handles all five at once", () => {
      const everything = applyProperties(base, [...ENEMY_PROPERTIES]);
      expect(everything.armor).toBeGreaterThan(0);
      expect(everything.shield).toBeGreaterThan(0);
      expect(everything.speed).toBeGreaterThan(base.speed);
      expect(everything.phased).toBe(true);
      expect(everything.splitsInto).not.toBeNull();
    });
  });
});

describe("hasProperty", () => {
  it("reports membership", () => {
    const properties: EnemyProperty[] = ["armored", "swift"];
    expect(hasProperty(properties, "armored")).toBe(true);
    expect(hasProperty(properties, "phased")).toBe(false);
  });

  it("treats undefined as no properties", () => {
    expect(hasProperty(undefined, "armored")).toBe(false);
  });
});

describe("describeProperties", () => {
  // The UI must communicate properties, per the phase's definition of done.
  it("gives every property a label and a counter hint", () => {
    for (const property of ENEMY_PROPERTIES) {
      const described = describeProperties([property]);
      expect(described).toHaveLength(1);
      expect(described[0].label.length).toBeGreaterThan(0);
      expect(described[0].counter.length).toBeGreaterThan(0);
    }
  });

  it("describes a combination in a stable order", () => {
    const a = describeProperties(["swift", "armored"]);
    const b = describeProperties(["armored", "swift"]);
    expect(a.map((d) => d.property)).toEqual(b.map((d) => d.property));
  });
});
