import { defineConfig } from "vitest/config";

// Plain Node run, no Workers runtime. Everything that decides what an image
// looks like (parsing, clamping, colour maths, SVG assembly) is pure and
// belongs here. The raster path needs real wasm and is covered by the build.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    globals: true,
  },
});
