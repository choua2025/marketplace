/**
 * `?next=` on the login page: where to go after signing in, e.g. the booking
 * an email linked to. Only a path inside this site is accepted -- anything
 * else (another site, `//evil.com`, `/\evil.com`) is ignored, so the login
 * page can't be used to send people to a look-alike site.
 */
export function safeNextPath(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 500) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  return value;
}

/** The login page, returning to `next` (a locale-less path) afterwards. */
export function loginHref(next: string) {
  return { pathname: "/login", query: { next } } as const;
}
