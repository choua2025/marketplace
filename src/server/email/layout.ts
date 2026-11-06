import th from "../../../messages/th.json";
import en from "../../../messages/en.json";
import lo from "../../../messages/lo.json";
import type { EmailMessage } from "./provider";

export const EMAIL_MESSAGES = { th, en, lo } as const;
export type Locale = keyof typeof EMAIL_MESSAGES;

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "th" || value === "en" || value === "lo";
}

/** Fills `{name}`-style placeholders. Email copy is plain text, so no ICU needed. */
export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface EmailContent {
  to: string;
  locale: Locale;
  subject: string;
  name: string;
  /** Body paragraphs, in order. */
  paragraphs: string[];
  /** Shown as a quoted block under the paragraphs (e.g. a chat message). */
  quote?: string;
  button: { label: string; url: string };
  /** Small print under the button (e.g. "this link expires in 1 hour"). */
  notes?: string[];
  /** Last line, e.g. why the user got this email. */
  footer: string;
}

/** The one layout every ChangDee email uses, as both HTML and plain text. */
export function renderEmail(content: EmailContent): EmailMessage {
  const m = EMAIL_MESSAGES[content.locale].email;
  const brand = EMAIL_MESSAGES[content.locale].common.brand;
  const greeting = fill(m.greeting, { name: content.name });
  const notes = content.notes?.filter(Boolean) ?? [];
  const { url, label } = content.button;

  const text = [
    greeting,
    ...content.paragraphs.flatMap((p) => ["", p]),
    ...(content.quote ? ["", `"${content.quote}"`] : []),
    "",
    url,
    "",
    ...notes,
    content.footer,
  ].join("\n");

  const paragraphsHtml = content.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151">${escapeHtml(p)}</p>`,
    )
    .join("");
  const quoteHtml = content.quote
    ? `<p style="margin:0 0 16px;padding:12px 16px;border-left:4px solid #2563eb;background:#f4f6fb;border-radius:8px;font-size:15px;line-height:1.6;color:#111827;white-space:pre-line">${escapeHtml(content.quote)}</p>`
    : "";
  const notesHtml = notes
    .map((n) => `<p style="margin:0 0 8px;font-size:13px;color:#6b7280">${escapeHtml(n)}</p>`)
    .join("");

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f4f6fb;font-family:Arial,'Noto Sans Thai','Noto Sans Lao',sans-serif;color:#111827">
  <table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px">
    <tr><td>
      <p style="margin:0 0 24px;font-size:20px;font-weight:bold;color:#2563eb">${escapeHtml(brand)}</p>
      <p style="margin:0 0 12px;font-size:16px">${escapeHtml(greeting)}</p>
      ${paragraphsHtml}
      ${quoteHtml}
      <p style="margin:8px 0 24px"><a href="${escapeHtml(url)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:10px">${escapeHtml(label)}</a></p>
      ${notesHtml}
      <p style="margin:0 0 4px;font-size:13px;color:#6b7280">${escapeHtml(m.linkFallback)}</p>
      <p style="margin:0 0 24px;font-size:12px;word-break:break-all;color:#2563eb">${escapeHtml(url)}</p>
      <p style="margin:0;font-size:12px;color:#9ca3af">${escapeHtml(content.footer)}</p>
    </td></tr>
  </table>
</body></html>`;

  return { to: content.to, subject: `${content.subject} - ${brand}`, html, text };
}

/** Absolute link to a page in the given language (Thai, the default, has no prefix). */
export function pageUrl(appUrl: string, locale: Locale, path: string): string {
  return `${appUrl}${locale === "th" ? "" : `/${locale}`}${path}`;
}
