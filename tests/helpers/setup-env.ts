import { loadTestEnv } from "./load-test-env";

// Runs before each test file's module graph loads. Anything that
// transitively imports src/server/lib/env.ts (e.g. src/server/auth/auth.ts
// via src/server/db/client.ts) must see the *test* database, not dev --
// this has to happen before that import chain runs, which is why it's a
// setupFile and not just code inside a test.
loadTestEnv();

if (process.env.DATABASE_TEST_APP_URL) {
  process.env.DATABASE_APP_URL = process.env.DATABASE_TEST_APP_URL;
}
