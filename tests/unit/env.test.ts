import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const UNDER_TEST = ["NODE_ENV", "APP_URL", "DATABASE_APP_URL"];

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
};

describe("server/lib/env", () => {
  it("parses a valid configuration", async () => {
    setEnv(VALID);

    const { env } = await import("@/server/lib/env");

    expect(env).toEqual(VALID);
  });

  it("defaults NODE_ENV to development when unset", async () => {
    setEnv({ APP_URL: VALID.APP_URL, DATABASE_APP_URL: VALID.DATABASE_APP_URL });

    const { env } = await import("@/server/lib/env");

    expect(env.NODE_ENV).toBe("development");
  });

  it("throws when APP_URL is missing", async () => {
    setEnv({ NODE_ENV: VALID.NODE_ENV, DATABASE_APP_URL: VALID.DATABASE_APP_URL });

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
    setEnv({ NODE_ENV: VALID.NODE_ENV, APP_URL: VALID.APP_URL });

    await expect(import("@/server/lib/env")).rejects.toThrow(/DATABASE_APP_URL/);
  });
});
