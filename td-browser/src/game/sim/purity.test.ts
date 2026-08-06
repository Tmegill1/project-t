import { describe, expect, it } from "vitest";

/**
 * Source text of every module in this directory, loaded through Vite's raw
 * glob rather than `node:fs`.
 *
 * Using the bundler's own file resolution keeps this test free of `@types/node`
 * (the project restricts `types` to `vite/client`) and means the scan sees
 * exactly the files Vite would resolve.
 */
const SIM_SOURCES = import.meta.glob("./**/*.ts", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

/** Removes block and line comments so prose mentioning Phaser is not mistaken
 *  for a dependency on it. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/**
 * Returns the offending module specifier if the source depends on Phaser, else
 * null. Covers static imports, re-exports, dynamic `import()`, and `require()`,
 * including subpath specifiers such as "phaser/src/math".
 */
export function findPhaserImport(source: string): string | null {
  const code = stripComments(source);
  const patterns = [
    /\b(?:from|import|require)\s*\(?\s*["'`](phaser(?:\/[^"'`]*)?)["'`]/,
    /\bimport\s+["'`](phaser(?:\/[^"'`]*)?)["'`]/,
  ];
  for (const pattern of patterns) {
    const match = code.match(pattern);
    if (match) return match[1];
  }
  return null;
}

describe("findPhaserImport", () => {
  // Proves the detector actually detects, before it is trusted to police the
  // directory. A guard that cannot fail is not a guard.
  it.each([
    ['import Phaser from "phaser";', "phaser"],
    ["import Phaser from 'phaser';", "phaser"],
    ['import "phaser";', "phaser"],
    ['export { Scene } from "phaser";', "phaser"],
    ['const P = await import("phaser");', "phaser"],
    ['const P = require("phaser");', "phaser"],
    ['import { Math as M } from "phaser/src/math";', "phaser/src/math"],
    ['import Phaser  from   "phaser" ;', "phaser"],
  ])("flags %s", (source, expected) => {
    expect(findPhaserImport(source)).toBe(expected);
  });

  it.each([
    ["// this module is deliberately free of phaser", "line comment"],
    ["/* no phaser here, see ARCHITECTURE.md */", "block comment"],
    ['const label = "phaser";', "unrelated string literal"],
    ['import { thing } from "./phaser-adapter";', "similarly named local module"],
    ['import { thing } from "dephaser";', "specifier merely containing the word"],
    ["", "empty file"],
  ])("does not flag %s (%s)", (source) => {
    expect(findPhaserImport(source)).toBeNull();
  });
});

describe("sim purity", () => {
  // Only the simulation modules are scanned, not the tests beside them. Test
  // files legitimately contain import-shaped *strings* as fixtures — this very
  // file does — and flagging those would be a false positive. The detector's
  // own correctness is covered by the cases above, so nothing is taken on trust.
  const modules = Object.entries(SIM_SOURCES).filter(([path]) => !path.endsWith(".test.ts"));

  // Guards the guard: if the glob silently matched nothing, every assertion
  // below would pass vacuously and the rule would go unenforced.
  it("finds simulation modules to check", () => {
    expect(modules.length).toBeGreaterThan(0);
  });

  it.each(modules)("%s does not import Phaser", (path, source) => {
    const offender = findPhaserImport(source);
    expect(
      offender,
      `src/game/sim/${path.replace(/^\.\//, "")} imports "${offender}". The ` +
        `simulation layer must stay ` +
        `Phaser-free so game rules can be tested without a scene, textures, or a ` +
        `render context — that separation is what makes every balance test in later ` +
        `phases possible. Keep the rendering concern in the view layer.`,
    ).toBeNull();
  });

  it("runs in a DOM-free environment", () => {
    // Purity is only meaningful if the environment cannot supply the browser
    // globals a stray Phaser dependency would reach for.
    expect(typeof globalThis.document).toBe("undefined");
  });
});
