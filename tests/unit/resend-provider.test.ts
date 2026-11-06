import { afterEach, describe, expect, it, vi } from "vitest";
import { ResendEmailProvider } from "@/server/email/resend-provider";

const message = { to: "someone@example.com", subject: "s", html: "<p>h</p>", text: "t" };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ResendEmailProvider", () => {
  it("includes Resend's reason in the error, with email addresses masked", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            message:
              "You can only send testing emails to your own email address (owner@gmail.com). Please verify a domain.",
          },
          { status: 403 },
        ),
      ),
    );
    const provider = new ResendEmailProvider({ apiKey: "re_test", from: "a <a@resend.dev>" });

    const error = await provider.send(message).catch((e: Error) => e);
    expect(String(error)).toContain("HTTP 403");
    expect(String(error)).toContain("verify a domain");
    expect(String(error)).toContain("([email])");
    expect(String(error)).not.toContain("owner@gmail.com");
  });

  it("still reports the status when the body isn't JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("bad gateway", { status: 502 })),
    );
    const provider = new ResendEmailProvider({ apiKey: "re_test", from: "a <a@resend.dev>" });

    await expect(provider.send(message)).rejects.toThrow("Resend rejected the email (HTTP 502)");
  });
});
