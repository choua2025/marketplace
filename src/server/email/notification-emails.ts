import type { EmailMessage } from "./provider";
import { EMAIL_MESSAGES, fill, renderEmail, type Locale } from "./layout";

/** Longest chat excerpt quoted in a new-message email. */
const PREVIEW_MAX = 200;

export function buildNewBookingEmail(data: {
  to: string;
  locale: Locale;
  providerName: string;
  customerName: string;
  categoryName: string;
  /** Already formatted in the provider's time zone and language. */
  when: string;
  url: string;
}): EmailMessage {
  const m = EMAIL_MESSAGES[data.locale].email;
  return renderEmail({
    to: data.to,
    locale: data.locale,
    subject: fill(m.newBookingSubject, { name: data.customerName }),
    name: data.providerName,
    paragraphs: [
      fill(m.newBookingIntro, {
        name: data.customerName,
        category: data.categoryName,
        when: data.when,
      }),
      m.newBookingAction,
    ],
    button: { label: m.newBookingButton, url: data.url },
    footer: m.notificationFooter,
  });
}

export function buildNewMessageEmail(data: {
  to: string;
  locale: Locale;
  recipientName: string;
  senderName: string;
  /** The message text; null for a photo-only message. */
  body: string | null;
  url: string;
}): EmailMessage {
  const m = EMAIL_MESSAGES[data.locale].email;
  const body = data.body?.trim();
  const quote = body
    ? body.length > PREVIEW_MAX
      ? `${body.slice(0, PREVIEW_MAX).trimEnd()}…`
      : body
    : m.newMessagePhoto;
  return renderEmail({
    to: data.to,
    locale: data.locale,
    subject: fill(m.newMessageSubject, { name: data.senderName }),
    name: data.recipientName,
    paragraphs: [fill(m.newMessageIntro, { name: data.senderName })],
    quote,
    button: { label: m.newMessageButton, url: data.url },
    notes: [m.newMessageNote],
    footer: m.notificationFooter,
  });
}
