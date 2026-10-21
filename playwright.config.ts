import { defineConfig, devices } from "@playwright/test";

// Matches APP_URL/BETTER_AUTH_URL in .env.example -- Better Auth rejects
// requests whose origin doesn't match its configured trusted origin.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:7000";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  // Both flows hit the same dev server and seeded database -- run them
  // one at a time to avoid cross-test interference.
  workers: 1,
  retries: 0,
  // loginAsDevUser() backs off and retries on Better Auth's sign-in rate
  // limit (up to 5x 11s waits) -- the default 30s per-test timeout isn't
  // enough headroom for that plus the rest of a flow's steps.
  timeout: 90_000,
  reporter: "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  // SPEC.md section 12: E2E runs at mobile viewport size.
  projects: [
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
