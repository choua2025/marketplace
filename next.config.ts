import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // Standalone output for the production Dockerfile (SPEC.md section 14) --
  // bundles only the dependencies actually used at runtime into .next/standalone.
  // Security headers (SPEC.md section 11) live in src/proxy.ts instead of
  // here: this config's values are frozen in at build time, but the CSP's
  // storage origin can differ between build and run (e.g. in Docker), so it
  // has to be computed per-request.
  output: "standalone",
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
