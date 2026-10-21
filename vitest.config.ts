import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Integration test files share one Postgres database and each
    // truncates it in beforeEach -- running files in parallel races
    // one file's reset against another's inserts.
    fileParallelism: false,
    globalSetup: ["./tests/helpers/global-setup.ts"],
    setupFiles: ["./tests/helpers/setup-env.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});
