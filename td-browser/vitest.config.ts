import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Default to plain Node: the simulation layer under src/game/sim/ is pure
    // TypeScript with no DOM and no Phaser, and keeping the default environment
    // Phaser-free means an accidental DOM dependency fails loudly instead of
    // silently working. Files that genuinely need a DOM opt in per-file with:
    //   // @vitest-environment jsdom
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      // Only the pure layers are meaningfully coverable. Phaser view classes
      // need a live scene and render context, so they are excluded rather than
      // dragging the number down with code that cannot be unit tested.
      include: ["src/game/sim/**/*.ts", "src/game/data/**/*.ts"],
      reporter: ["text", "html"],
    },
  },
});
