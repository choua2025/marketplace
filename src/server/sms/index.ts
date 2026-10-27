import { env } from "@/server/lib/env";
import type { SmsProvider } from "./provider";
import { ConsoleSmsProvider } from "./console-provider";
import { TwilioSmsProvider } from "./twilio-provider";

export type { SmsProvider } from "./provider";

let provider: SmsProvider | undefined;

/** Test-only escape hatch so integration tests can read the OTP that was "sent". */
export function setSmsProviderForTesting(testProvider: SmsProvider): void {
  if (env.NODE_ENV !== "test") {
    throw new Error("setSmsProviderForTesting can only be used when NODE_ENV=test");
  }
  provider = testProvider;
}

export function getSmsProvider(): SmsProvider {
  if (provider) return provider;

  if (env.NODE_ENV === "test") {
    throw new Error("Call setSmsProviderForTesting() before using the SMS provider in tests.");
  }

  if (env.NODE_ENV !== "development") {
    if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_FROM) {
      // Fail loudly rather than silently pretending to send an SMS.
      throw new Error(
        "SMS is not configured: set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM.",
      );
    }
    provider = new TwilioSmsProvider({
      accountSid: env.TWILIO_ACCOUNT_SID,
      authToken: env.TWILIO_AUTH_TOKEN,
      from: env.TWILIO_FROM,
    });
    return provider;
  }

  provider = new ConsoleSmsProvider();
  return provider;
}
