import { defineConfig } from "vitest/config";


export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // The encryption helpers refuse to run without a key, which is the point.
    env: { SUBMISSIONS_ENCRYPTION_KEY: "test-key-not-used-in-production" },
    /*
      Test files run one at a time.

      The database suites share a single database and each clears the tables it
      uses before every test. Run in parallel, one file's cleanup lands in the
      middle of another file's test, and failures appear that have nothing to do
      with the code — which is exactly what happened: the suites passed
      individually and failed together, so a green run was a matter of
      scheduling rather than correctness.
    */
    fileParallelism: false,
  },
  resolve: {
    alias: { "@": import.meta.dirname },
  },
});
