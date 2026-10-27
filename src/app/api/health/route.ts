import { checkDatabase } from "@/server/services/health";

export const dynamic = "force-dynamic";

// Liveness + readiness probe: 200 only if Postgres answers. Deliberately
// returns no detail so it is safe to expose publicly.
export async function GET(): Promise<Response> {
  try {
    await checkDatabase();
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
