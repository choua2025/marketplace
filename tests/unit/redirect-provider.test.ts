import { describe, expect, it } from "vitest";
import { RedirectEmailProvider } from "@/server/email/redirect-provider";
import type { EmailMessage, EmailProvider } from "@/server/email";

describe("RedirectEmailProvider", () => {
  it("sends to the one inbox and names the real recipient in the subject", async () => {
    const sent: EmailMessage[] = [];
    const inner: EmailProvider = { send: async (m) => void sent.push(m) };

    await new RedirectEmailProvider(inner, "owner@example.com").send({
      to: "provider@example.com",
      subject: "New booking request",
      html: "<p>x</p>",
      text: "x",
    });

    expect(sent).toEqual([
      {
        to: "owner@example.com",
        subject: "[DEV → provider@example.com] New booking request",
        html: "<p>x</p>",
        text: "x",
      },
    ]);
  });
});
