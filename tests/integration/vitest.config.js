// vitest.config.js — integration tests
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.test.js"],
    // Integration tests are slow — give each test 30 seconds
    testTimeout: 30_000,
    // Run sequentially (tests share state via the running stack)
    sequence: { concurrent: false },
  },
});
