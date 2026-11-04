import { z } from "zod";

function emptyStringAsUndefined<T extends z.ZodType>(schema: T) {
  return z.preprocess((value) => (value === "" ? undefined : value), schema);
}

// Validated once at module load, so the server fails fast on boot instead
// of surfacing a confusing error deep inside a request handler. Grows
// milestone by milestone as new server code starts reading new variables --
// see .env.example for the full set the project will eventually need.
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url(),
  // App-role connection (DML only, no DDL -- see SPEC.md section 5.7).
  // Migrations/seed use DATABASE_URL (owner role) directly, not this file.
  DATABASE_APP_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.url(),
  // Optional: Google sign-in is disabled (not an error) until both are set.
  // .env.example ships these blank, so "" must count as unset too.
  GOOGLE_CLIENT_ID: emptyStringAsUndefined(z.string().min(1).optional()),
  GOOGLE_CLIENT_SECRET: emptyStringAsUndefined(z.string().min(1).optional()),
  // Optional: production SMS OTP (Twilio). Phone login fails with a clear
  // error in production until all three are set; dev uses the console provider.
  TWILIO_ACCOUNT_SID: emptyStringAsUndefined(z.string().min(1).optional()),
  TWILIO_AUTH_TOKEN: emptyStringAsUndefined(z.string().min(1).optional()),
  TWILIO_FROM: emptyStringAsUndefined(z.string().min(1).optional()),
  // Optional: transactional email (password reset, email verification) via
  // Resend. Dev prints emails to the console; production fails loudly when a
  // send is attempted without these. EMAIL_FROM e.g. "ChangDee <no-reply@your-domain>".
  RESEND_API_KEY: emptyStringAsUndefined(z.string().min(1).optional()),
  EMAIL_FROM: emptyStringAsUndefined(z.string().min(3).optional()),
  // File storage (avatars, portfolio, booking/chat photos, verification docs).
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),
  // All uploads go under this folder in the Cloudinary account.
  CLOUDINARY_FOLDER: emptyStringAsUndefined(z.string().min(1).default("changdee")),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  try {
    // Next.js loads .env itself before this module ever runs; this only
    // matters for CLI scripts (db:seed, db:reset) run directly via tsx.
    // Never overrides a variable that's already set (see Node docs), so
    // it's safe to call unconditionally -- including in tests, which set
    // process.env explicitly before importing this module.
    process.loadEnvFile(".env");
  } catch {
    // No .env file (e.g. production, where real env vars are injected
    // by the deployment platform) -- fall through to validation below.
  }

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
