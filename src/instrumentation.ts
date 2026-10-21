export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Importing for its validation side effect: throws immediately on
    // server boot if required env vars are missing/invalid.
    await import("@/server/lib/env");
  }
}
