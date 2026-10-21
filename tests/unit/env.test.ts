import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const UNDER_TEST = [
  "NODE_ENV",
  "APP_URL",
  "DATABASE_APP_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
];

let ORIGINAL_ENV: NodeJS.ProcessEnv;

function setEnv(overrides: Record<string, string>) {
  Object.assign(process.env, overrides);
}

beforeEach(() => {
  ORIGINAL_ENV = process.env;

  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value !== undefined && !UNDER_TEST.includes(key)) {
      next[key] = value;
    }
  }
  process.env = next as unknown as NodeJS.ProcessEnv;

  vi.resetModules();
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

const VALID = {
  NODE_ENV: "production",
  APP_URL: "https://changdee.example",
  DATABASE_APP_URL: "postgres://changdee_app:secret@localhost:55432/changdee",
  BETTER_AUTH_SECRET: "dev-secret",
  BETTER_AUTH_URL: "https://changdee.example",
};

describe("server/lib/env", () => {
  it("parses a valid configuration", async () => {
    setEnv(VALID);

    const { env } = await import("@/server/lib/env");

    expect(env).toEqual(VALID);
  });

  it("defaults NODE_ENV to development when unset", async () => {
    const { NODE_ENV: _omit, ...rest } = VALID;
    setEnv(rest);

    const { env } = await import("@/server/lib/env");

    expect(env.NODE_ENV).toBe("development");
  });

  it("throws when APP_URL is missing", async () => {
    const { APP_URL: _omit, ...rest } = VALID;
    setEnv(rest);

    await expect(import("@/server/lib/env")).rejects.toThrow(/APP_URL/);
  });

  it("throws when APP_URL is not a valid URL", async () => {
    setEnv({ ...VALID, APP_URL: "not-a-url" });

    await expect(import("@/server/lib/env")).rejects.toThrow(/APP_URL/);
  });

  it("throws when NODE_ENV is not one of the allowed values", async () => {
    setEnv({ ...VALID, NODE_ENV: "staging" });

    await expect(import("@/server/lib/env")).rejects.toThrow(/NODE_ENV/);
  });

  it("throws when DATABASE_APP_URL is missing", async () => {
    const { DATABASE_APP_URL: _omit, ...rest } = VALID;
    setEnv(rest);

    await expect(import("@/server/lib/env")).rejects.toThrow(/DATABASE_APP_URL/);
  });

  it("throws when BETTER_AUTH_SECRET is missing", async () => {
    const { BETTER_AUTH_SECRET: _omit, ...rest } = VALID;
    setEnv(rest);

    await expect(import("@/server/lib/env")).rejects.toThrow(/BETTER_AUTH_SECRET/);
  });

  it("leaves Google sign-in disabled (no error) when its env vars are unset", async () => {
    setEnv(VALID);

    const { env } = await import("@/server/lib/env");

    expect(env.GOOGLE_CLIENT_ID).toBeUndefined();
    expect(env.GOOGLE_CLIENT_SECRET).toBeUndefined();
  });
});
