import { env } from "@/server/lib/env";
import type { EmailProvider } from "./provider";
import { ConsoleEmailProvider } from "./console-provider";
import { ResendEmailProvider } from "./resend-provider";
import { RedirectEmailProvider } from "./redirect-provider";

export type { EmailMessage, EmailProvider } from "./provider";

let provider: EmailProvider | undefined;

/** Test-only escape hatch so integration tests can read the links that were "sent". */
export function setEmailProviderForTesting(testProvider: EmailProvider): void {
  if (env.NODE_ENV !== "test") {
    throw new Error("setEmailProviderForTesting can only be used when NODE_ENV=test");
  }
  provider = testProvider;
}

export function getEmailProvider(): EmailProvider {
  if (provider) return provider;

  if (env.NODE_ENV === "test") {
    throw new Error("Call setEmailProviderForTesting() before sending email in tests.");
  }

  // Real sending whenever Resend is configured -- in development too, so
  // emails can be tried out in a real inbox before going live.
  if (env.RESEND_API_KEY && env.EMAIL_FROM) {
    const resend = new ResendEmailProvider({ apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM });
    provider =
      env.NODE_ENV === "development" && env.EMAIL_DEV_REDIRECT_TO
        ? new RedirectEmailProvider(resend, env.EMAIL_DEV_REDIRECT_TO)
        : resend;
    return provider;
  }

  if (env.NODE_ENV !== "development") {
    // Fail loudly rather than silently pretending to send an email.
    throw new Error("Email is not configured: set RESEND_API_KEY and EMAIL_FROM.");
  }

  // Development without Resend: print emails (and their links) to the server log.
  provider = new ConsoleEmailProvider();
  return provider;
}
