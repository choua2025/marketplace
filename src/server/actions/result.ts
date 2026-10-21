export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Wraps a service call so Server Actions never throw across the client/server boundary. */
export function toActionResult<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  return fn()
    .then((data) => ({ ok: true as const, data }))
    .catch((error: unknown) => ({
      ok: false as const,
      error: error instanceof Error ? error.message : "UNKNOWN_ERROR",
    }));
}
