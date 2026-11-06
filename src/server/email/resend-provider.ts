import type { EmailMessage, EmailProvider } from "./provider";

/** Sends through Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email). */
export class ResendEmailProvider implements EmailProvider {
  constructor(private readonly config: { apiKey: string; from: string }) {}

  async send(message: EmailMessage): Promise<void> {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.config.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });
    if (!response.ok) {
      const reason = await readReason(response);
      throw new Error(
        `Resend rejected the email (HTTP ${response.status})${reason ? `: ${reason}` : ""}`,
      );
    }
  }
}

/**
 * Resend's explanation (e.g. "verify a domain"), with email addresses masked:
 * it often echoes the recipient's, and logs shouldn't collect those.
 */
async function readReason(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as { message?: unknown };
    if (typeof body.message !== "string") return null;
    return body.message.replace(/[^\s()<>@]+@[^\s()<>@]+\.[a-z]{2,}/gi, "[email]").slice(0, 300);
  } catch {
    return null;
  }
}
