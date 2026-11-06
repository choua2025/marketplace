import type { EmailMessage, EmailProvider } from "./provider";

/**
 * Development helper: sends every email to one inbox, keeping the real
 * recipient in the subject so it's clear who it was meant for.
 */
export class RedirectEmailProvider implements EmailProvider {
  constructor(
    private readonly inner: EmailProvider,
    private readonly to: string,
  ) {}

  send(message: EmailMessage): Promise<void> {
    return this.inner.send({
      ...message,
      to: this.to,
      subject: `[DEV → ${message.to}] ${message.subject}`,
    });
  }
}
