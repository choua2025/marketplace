import th from "../../../messages/th.json";
import en from "../../../messages/en.json";
import lo from "../../../messages/lo.json";
import { getEmailProvider, type EmailMessage } from "./index";

const MESSAGES = { th, en, lo } as const;
type Locale = keyof typeof MESSAGES;
export type AuthEmailKind = "verifyEmail" | "resetPassword";

function isLocale(value: string | undefined): value is Locale {
  return value === "th" || value === "en" || value === "lo";
}

/**
 * The language of the page the request came from: the /en or /lo prefix of
 * the Referer (Thai, the default locale, has no prefix), else the next-intl
 * cookie, else Thai.
 */
export function localeFromRequest(request?: Request): Locale {
  const referer = request?.headers.get("referer");
  if (referer) {
    try {
      const first = new URL(referer).pathname.split("/")[1];
      if (isLocale(first)) return first;
      return "th";
    } catch {
      // fall through
    }
  }
  const cookie = request?.headers.get("cookie")?.match(/(?:^|;\s*)NEXT_LOCALE=([a-z]+)/)?.[1];
  return isLocale(cookie) ? cookie : "th";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildAuthEmail(
  kind: AuthEmailKind,
  data: { to: string; name: string; url: string; locale: Locale },
): EmailMessage {
  const m = MESSAGES[data.locale].email;
  const brand = MESSAGES[data.locale].common.brand;
  const copy =
    kind === "verifyEmail"
      ? {
          subject: m.verifySubject,
          intro: m.verifyIntro,
          button: m.verifyButton,
          expiry: m.verifyExpiry,
        }
      : {
          subject: m.resetSubject,
          intro: m.resetIntro,
          button: m.resetButton,
          expiry: m.resetExpiry,
        };
  const greeting = m.greeting.replace("{name}", data.name);

  const text = [greeting, "", copy.intro, "", data.url, "", copy.expiry, m.ignoreNote].join("\n");
  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f4f6fb;font-family:Arial,'Noto Sans Thai','Noto Sans Lao',sans-serif;color:#111827">
  <table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px">
    <tr><td>
      <p style="margin:0 0 24px;font-size:20px;font-weight:bold;color:#2563eb">${escapeHtml(brand)}</p>
      <p style="margin:0 0 12px;font-size:16px">${escapeHtml(greeting)}</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#374151">${escapeHtml(copy.intro)}</p>
      <p style="margin:0 0 24px"><a href="${escapeHtml(data.url)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:10px">${escapeHtml(copy.button)}</a></p>
      <p style="margin:0 0 8px;font-size:13px;color:#6b7280">${escapeHtml(copy.expiry)}</p>
      <p style="margin:0 0 4px;font-size:13px;color:#6b7280">${escapeHtml(m.linkFallback)}</p>
      <p style="margin:0 0 24px;font-size:12px;word-break:break-all;color:#2563eb">${escapeHtml(data.url)}</p>
      <p style="margin:0;font-size:12px;color:#9ca3af">${escapeHtml(m.ignoreNote)}</p>
    </td></tr>
  </table>
</body></html>`;

  return { to: data.to, subject: `${copy.subject} - ${brand}`, html, text };
}

/**
 * Not awaited by callers on purpose: answering at the same speed whether or
 * not an account exists keeps response timing from revealing which emails
 * are registered. Failures are logged instead of surfaced.
 */
export function sendAuthEmail(
  kind: AuthEmailKind,
  user: { email: string; name: string },
  url: string,
  request?: Request,
): void {
  const logFailure = (error: unknown) => {
    console.error(`[email] ${kind} email failed:`, error instanceof Error ? error.message : error);
  };
  const message = buildAuthEmail(kind, {
    to: user.email,
    name: user.name,
    url,
    locale: localeFromRequest(request),
  });
  try {
    getEmailProvider().send(message).catch(logFailure);
  } catch (error) {
    // e.g. email not configured in production -- same response either way.
    logFailure(error);
  }
}
