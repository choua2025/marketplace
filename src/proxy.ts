import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

/**
 * Security headers (SPEC.md section 11). Computed per-request rather than
 * in next.config.ts's `headers()` because the storage origin (S3/Garage/R2)
 * can differ between build time and run time -- e.g. in Docker, where the
 * image is built once but configured with real env vars at `docker run`.
 */
function withSecurityHeaders(response: NextResponse): NextResponse {
  const storageOrigin = process.env.S3_ENDPOINT ? new URL(process.env.S3_ENDPOINT).origin : "";

  // React dev mode (Fast Refresh, error overlay) uses eval() -- allow it
  // only outside production so the CSP doesn't break `next dev`/Turbopack.
  const scriptSrc =
    process.env.NODE_ENV === "production"
      ? "script-src 'self' 'unsafe-inline'"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

  const csp = [
    "default-src 'self'",
    `img-src 'self' data: ${storageOrigin}`,
    `connect-src 'self' ${storageOrigin}`,
    // The inline theme script and JSON-LD <script> tags need
    // 'unsafe-inline' since there's no per-request nonce wired up here --
    // see PLAN.md.
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
  return response;
}

export default function proxy(request: NextRequest): NextResponse {
  // i18n routing doesn't apply to API routes -- just pass them through.
  const response = request.nextUrl.pathname.startsWith("/api")
    ? NextResponse.next()
    : intlMiddleware(request);
  return withSecurityHeaders(response);
}

export const config = {
  // Runs on every request except Next internals and files with an
  // extension (favicon.ico, icon-192.png, etc) -- those are static assets
  // served as-is and don't need these headers.
  matcher: "/((?!_next|_vercel|.*\\..*).*)",
};
