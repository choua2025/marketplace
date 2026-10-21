import type { MetadataRoute } from "next";
import { env } from "@/server/lib/env";
import { routing } from "@/i18n/routing";

const PRIVATE_PATHS = ["/bookings", "/messages", "/dashboard", "/login"];

export default function robots(): MetadataRoute.Robots {
  // Disallow rules match literal path prefixes, so each private path needs
  // both its default-locale (no prefix) and localized (/en/...) forms.
  const disallow = [
    "/api/",
    ...PRIVATE_PATHS,
    ...routing.locales
      .filter((locale) => locale !== routing.defaultLocale)
      .flatMap((locale) => PRIVATE_PATHS.map((path) => `/${locale}${path}`)),
  ];

  return {
    rules: { userAgent: "*", allow: "/", disallow },
    sitemap: `${env.APP_URL}/sitemap.xml`,
  };
}
