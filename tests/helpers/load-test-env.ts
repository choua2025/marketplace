// Vitest (unlike Next's own dev/build process) does not auto-load .env --
// every entry point that needs DATABASE_TEST_URL/DATABASE_TEST_APP_URL
// must call this first. Safe to call repeatedly: loadEnvFile never
// overrides a variable that's already set.
export function loadTestEnv(): void {
  try {
    process.loadEnvFile(".env");
  } catch {
    // No .env file -- rely on vars already present in the environment
    // (e.g. CI, which sets them directly).
  }
}
