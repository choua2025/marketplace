import type { SmsProvider } from "./provider";

// Dev-only convenience: prints the OTP to the server terminal instead of
// sending a real SMS (SPEC.md section 4). Never wired up outside
// NODE_ENV=development -- see index.ts -- so this never runs in
// production and is unrelated to the "no OTP in logs" rule in section 11,
// which is about the application's real logging/observability pipeline.
export class ConsoleSmsProvider implements SmsProvider {
  async sendOtp(phoneNumber: string, code: string): Promise<void> {
    console.log(`[sms:console] OTP for ${phoneNumber}: ${code}`);
  }
}
