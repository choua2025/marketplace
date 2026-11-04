import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Prisma's pg adapter only round-trips `timestamptz` correctly when the
 * session time zone is UTC: under any other zone it writes and reads every
 * timestamp shifted by that zone's offset (e.g. 7h early on a Postgres whose
 * default zone is Asia/Bangkok, as a Thai Windows install has). Pinning the
 * session to UTC makes stored values correct regardless of server settings;
 * display zones are handled by next-intl, never by the database.
 */
export function createPrismaAdapter(connectionString: string) {
  return new PrismaPg({ connectionString, options: "-c TimeZone=UTC" });
}
