import type { MetadataRoute } from "next";
import { env } from "@/server/lib/env";
import { listActiveProviderIds } from "@/server/services/sitemap";
import { routing } from "@/i18n/routing";

// Reads the active-provider list from the DB on every request -- a Docker
// build has no database to reach at build time.
export const dynamic = "force-dynamic";

function localizedPaths(path: string): string[] {
  return routing.locales.map((locale) => {
    const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
    return `${env.APP_URL}${prefix}${path}`;
  });
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const providerIds = await listActiveProviderIds();

  const staticEntries: MetadataRoute.Sitemap = ["/", "/search"].flatMap((path) =>
    localizedPaths(path).map((url) => ({ url, changeFrequency: "daily" as const })),
  );

  const providerEntries: MetadataRoute.Sitemap = providerIds.flatMap((id) =>
    localizedPaths(`/p/${id}`).map((url) => ({ url, changeFrequency: "weekly" as const })),
  );

  return [...staticEntries, ...providerEntries];
}
