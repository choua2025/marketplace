import type { SmsProvider } from "./provider";

interface TwilioConfig {
  accountSid: string;
  authToken: string;
  from: string;
}

// Production SMS via Twilio's REST API. Uses fetch directly so no SDK
// dependency is needed. The OTP body is never logged (SPEC.md section 11).
export class TwilioSmsProvider implements SmsProvider {
  constructor(private readonly config: TwilioConfig) {}

  async sendOtp(phoneNumber: string, code: string): Promise<void> {
    const { accountSid, authToken, from } = this.config;
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: phoneNumber,
          From: from,
          Body: `รหัส OTP ของ ChangDee คือ ${code} (ใช้ได้ 5 นาที)`,
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (!response.ok) {
      throw new Error(`Twilio SMS request failed with status ${response.status}`);
    }
  }
}
