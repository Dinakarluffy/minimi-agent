import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*_test.ts", "src/**/*.test.ts", "tests/**/*.test.ts"],
    environment: "node",
    testTimeout: 15000,
  },
});
