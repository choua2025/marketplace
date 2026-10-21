export interface SmsProvider {
  sendOtp(phoneNumber: string, code: string): Promise<void>;
}
