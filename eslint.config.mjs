import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import eslintConfigPrettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Architecture rule (SPEC.md section 5.2): the Drizzle client/schema may
  // only be imported from inside src/server -- UI components, pages, and
  // route handlers must go through the service layer instead of running
  // queries directly.
  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["src/server/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["drizzle-orm", "drizzle-orm/*"],
              message:
                "Import Drizzle only inside src/server (repository/service layer). UI code and route handlers must call a service function instead.",
            },
            {
              group: ["@/server/db", "@/server/db/*"],
              message:
                "The Drizzle client/schema is internal to src/server. Call a service function from src/server/services instead.",
            },
          ],
        },
      ],
    },
  },
  eslintConfigPrettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
