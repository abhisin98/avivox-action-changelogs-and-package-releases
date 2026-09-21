import { defineConfig } from "@rslib/core";

export default defineConfig({
  lib: [
    {
      format: "cjs",
      syntax: "es2022",
      bundle: true,
      autoExternal: false,
    },
  ],
  source: {
    entry: {
      index: ["src/index.ts"],
    },
    tsconfigPath: "tsconfig.build.json",
  },
  output: {
    target: "node",
    distPath: "./dist",
    cleanDistPath: true,
  },
  mode: "production",
});
