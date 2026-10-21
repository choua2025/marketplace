import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let ORIGINAL_ENV: NodeJS.ProcessEnv;

function setEnv(overrides: Record<string, string>) {
  Object.assign(process.env, overrides);
}

beforeEach(() => {
  ORIGINAL_ENV = process.env;

  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value !== undefined && key !== "NODE_ENV" && key !== "APP_URL") {
      next[key] = value;
    }
  }
  process.env = next as unknown as NodeJS.ProcessEnv;

  vi.resetModules();
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe("server/lib/env", () => {
  it("parses a valid configuration", async () => {
    setEnv({ NODE_ENV: "production", APP_URL: "https://changdee.example" });

    const { env } = await import("@/server/lib/env");

    expect(env).toEqual({
      NODE_ENV: "production",
      APP_URL: "https://changdee.example",
    });
  });

  it("defaults NODE_ENV to development when unset", async () => {
    setEnv({ APP_URL: "http://localhost:3000" });

    const { env } = await import("@/server/lib/env");

    expect(env.NODE_ENV).toBe("development");
  });

  it("throws when APP_URL is missing", async () => {
    setEnv({ NODE_ENV: "development" });

    await expect(import("@/server/lib/env")).rejects.toThrow(/APP_URL/);
  });

  it("throws when APP_URL is not a valid URL", async () => {
    setEnv({ NODE_ENV: "development", APP_URL: "not-a-url" });

    await expect(import("@/server/lib/env")).rejects.toThrow(/APP_URL/);
  });

  it("throws when NODE_ENV is not one of the allowed values", async () => {
    setEnv({ NODE_ENV: "staging", APP_URL: "http://localhost:3000" });

    await expect(import("@/server/lib/env")).rejects.toThrow(/NODE_ENV/);
  });
});
