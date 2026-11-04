import type { EmailMessage, EmailProvider } from "@/server/email";

/** Captures emails instead of sending them, so tests can follow the links inside. */
export class RecordingEmailProvider implements EmailProvider {
  readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }

  /** The link inside the latest email to `to` (waits briefly -- sending isn't awaited). */
  async lastLinkTo(to: string): Promise<URL> {
    for (let i = 0; i < 50; i++) {
      const message = [...this.sent].reverse().find((m) => m.to === to);
      const url = message?.text.match(/https?:\/\/\S+/)?.[0];
      if (url) return new URL(url);
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`No email with a link was sent to ${to}`);
  }
}
