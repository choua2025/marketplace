import "server-only";
import { z } from "zod";

// Validated once at module load, so the server fails fast on boot instead
// of surfacing a confusing error deep inside a request handler. Grows
// milestone by milestone as new server code starts reading new variables --
// see .env.example for the full set the project will eventually need.
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }

  return parsed.data;
}

export const env = loadEnv();
