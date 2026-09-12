import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    fileParallelism: false,
    include: [
      "shared/**/*.spec.ts",
      "server/**/*.spec.ts",
      "client/**/*.spec.ts",
    ],
    setupFiles: ["server/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "coverage",
      include: ["shared/src/**/*.ts", "server/src/**/*.ts"],
      exclude: [
        "**/*.spec.ts",
        "server/src/main.ts",
        "server/src/types/**",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 70,
      },
    },
  },
});
