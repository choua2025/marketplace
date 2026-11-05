import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { GOOGLE_PHOTO_IMG_SRC } from "./lib/google-photo";

const intlMiddleware = createMiddleware(routing);

// Cloudinary: res. serves signed CDN images, api. receives browser uploads
// and serves expiring private-file URLs.
const STORAGE_IMG_SRC = "https://res.cloudinary.com https://api.cloudinary.com";
const STORAGE_CONNECT_SRC = "https://api.cloudinary.com";

/** Security headers (SPEC.md section 11). */
function withSecurityHeaders(response: NextResponse): NextResponse {
  // React dev mode (Fast Refresh, error overlay) uses eval() -- allow it
  // only outside production so the CSP doesn't break `next dev`/Turbopack.
  const scriptSrc =
    process.env.NODE_ENV === "production"
      ? "script-src 'self' 'unsafe-inline'"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

  const csp = [
    "default-src 'self'",
    // blob: is for client-side local previews of not-yet-uploaded files
    // (e.g. the provider verification form, which batches several
    // documents before a single final submit) -- scoped to the page that
    // created it, never a network fetch.
    // tile.openstreetmap.org serves the Leaflet map tiles (a/b/c subdomains);
    // googleusercontent.com, the profile pictures of Google sign-ins.
    `img-src 'self' data: blob: https://*.tile.openstreetmap.org ${STORAGE_IMG_SRC} ${GOOGLE_PHOTO_IMG_SRC}`,
    `connect-src 'self' ${STORAGE_CONNECT_SRC}`,
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
