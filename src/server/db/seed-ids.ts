import { createHash } from "node:crypto";

/**
 * Name-based UUID (RFC 4122 version-5 layout): the same key always gives the
 * same id, so re-running the seed updates the same rows instead of adding
 * duplicates, and tests can look up seeded records without hard-coding ids.
 */
export function seedUuid(key: string): string {
  const hex = createHash("sha1").update(`changdee-seed:${key}`).digest("hex");
  const variant = ((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `${variant}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

export const SEED_IDS = {
  admin: seedUuid("user:admin"),
  /** n = 1..5 */
  customer: (n: number) => seedUuid(`user:customer:${n}`),
  /** n = 1..5 */
  provider: (n: number) => seedUuid(`user:provider:${n}`),
};
