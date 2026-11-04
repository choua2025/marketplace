import { headers } from "next/headers";
import { db } from "@/server/db/client";
import type { Actor } from "@/server/lib/actor";
import { auth } from "./auth";

/**
 * Resolves the caller's Actor (SPEC.md section 5.1) for use in Server
 * Actions and Server Components -- never trust a role/id from client
 * input, always re-derive it here from the session + profiles row.
 */
export async function getActor(): Promise<Actor | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const profile = await db.profile.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!profile) return null;

  return { id: session.user.id, role: profile.role };
}
