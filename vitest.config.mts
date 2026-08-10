import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // The encryption helpers refuse to run without a key, which is the point.
    env: { SUBMISSIONS_ENCRYPTION_KEY: "test-key-not-used-in-production" },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
