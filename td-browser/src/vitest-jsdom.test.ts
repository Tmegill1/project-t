// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

// Proves the per-file jsdom opt-in works, so view-layer tests that genuinely
// need a DOM have a supported path without changing the global default.
describe("jsdom opt-in", () => {
  it("provides a DOM when a file requests it", () => {
    expect(typeof document).toBe("object");
    const el = document.createElement("canvas");
    expect(el.tagName).toBe("CANVAS");
  });
});
