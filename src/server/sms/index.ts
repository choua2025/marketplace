import { env } from "@/server/lib/env";
import type { SmsProvider } from "./provider";
import { ConsoleSmsProvider } from "./console-provider";

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
    // SPEC.md section 4: a real provider gets wired in here later. Fail
    // loudly rather than silently pretending to send an SMS.
    throw new Error("No production SmsProvider configured yet. See src/server/sms/provider.ts.");
  }

  provider = new ConsoleSmsProvider();
  return provider;
}
