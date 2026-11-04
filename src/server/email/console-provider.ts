import type { EmailMessage, EmailProvider } from "./provider";

// Dev-only: prints the email (including its link) to the server terminal
// instead of sending it. Only used when NODE_ENV=development -- see index.ts.
export class ConsoleEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<void> {
    console.log(`[email:console] to=${message.to} subject="${message.subject}"\n${message.text}`);
  }
}
