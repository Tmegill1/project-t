import { describe, expect, it } from "vitest";

// Guards the test infrastructure itself. The simulation layer's purity rules
// only hold if the default test environment stays DOM-free — if someone flips
// the Vitest default to jsdom, a sim module could reach for `document` and no
// test would notice. These assertions make that regression fail loudly.
describe("vitest environment", () => {
  it("runs the default suite without a DOM", () => {
    expect(typeof globalThis.document).toBe("undefined");
    expect(typeof globalThis.window).toBe("undefined");
  });

  it("evaluates TypeScript with the project's strict settings", () => {
    const double = (n: number): number => n * 2;
    expect(double(21)).toBe(42);
  });
});
