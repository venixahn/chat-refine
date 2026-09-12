import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: [
      "shared/**/*.spec.ts",
      "server/**/*.spec.ts",
      "client/**/*.spec.ts",
    ],
    setupFiles: ["server/test/setup.ts"],
  },
});
