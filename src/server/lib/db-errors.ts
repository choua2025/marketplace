import { Prisma } from "@/server/db/generated/prisma/client";

/**
 * PostgreSQL SQLSTATE code (e.g. "23P01" for an exclusion constraint
 * violation). Prisma's pg driver adapter doesn't map every SQLSTATE to one
 * of its own error codes -- unmapped ones (like our exclusion constraint)
 * surface as a generic PrismaClientKnownRequestError with the raw code
 * preserved at error.meta.driverAdapterError.cause.originalCode.
 */
export function getPgErrorCode(error: unknown): string | undefined {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return undefined;
  const meta = error.meta as
    { driverAdapterError?: { cause?: { originalCode?: unknown } } } | undefined;
  const code = meta?.driverAdapterError?.cause?.originalCode;
  return typeof code === "string" ? code : undefined;
}
