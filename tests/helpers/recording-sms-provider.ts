import type { SmsProvider } from "@/server/sms/provider";

/** Captures OTPs instead of sending them, so tests can read the code back. */
export class RecordingSmsProvider implements SmsProvider {
  private readonly codesByPhone = new Map<string, string>();

  async sendOtp(phoneNumber: string, code: string): Promise<void> {
    this.codesByPhone.set(phoneNumber, code);
  }

  getLastCode(phoneNumber: string): string {
    const code = this.codesByPhone.get(phoneNumber);
    if (!code) throw new Error(`No OTP was sent to ${phoneNumber}`);
    return code;
  }
}
