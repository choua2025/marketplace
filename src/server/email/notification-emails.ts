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

/**
 * Booking status changes the other party is emailed about. "slotTaken": the
 * request was cancelled automatically because the provider confirmed another
 * booking for overlapping time.
 */
export type NotifiedBookingStatus = "confirmed" | "completed" | "cancelled" | "slotTaken";

export function buildBookingStatusEmail(data: {
  to: string;
  locale: Locale;
  recipientName: string;
  /** Who made the change: the provider, or for a cancellation either side. */
  otherName: string;
  categoryName: string;
  /** Already formatted in the provider's time zone and language. */
  when: string;
  status: NotifiedBookingStatus;
  cancelReason?: string | null;
  /** Booking page; for "completed", the review page; for "slotTaken", booking the provider again. */
  url: string;
}): EmailMessage {
  const m = EMAIL_MESSAGES[data.locale].email;
  const values = { name: data.otherName, category: data.categoryName, when: data.when };
  const content = {
    confirmed: {
      subject: m.bookingConfirmedSubject,
      paragraphs: [m.bookingConfirmedIntro],
      notes: [m.bookingConfirmedNote],
      button: m.bookingButton,
    },
    completed: {
      subject: m.bookingCompletedSubject,
      paragraphs: [m.bookingCompletedIntro, m.bookingCompletedAction],
      notes: [],
      button: m.bookingCompletedButton,
    },
    cancelled: {
      subject: m.bookingCancelledSubject,
      paragraphs: [m.bookingCancelledIntro, ...(data.cancelReason ? [m.bookingCancelledReason] : [])],
      notes: [],
      button: m.bookingButton,
    },
    slotTaken: {
      subject: m.bookingSlotTakenSubject,
      paragraphs: [m.bookingSlotTakenIntro, m.bookingSlotTakenAction],
      notes: [],
      button: m.bookingSlotTakenButton,
    },
  }[data.status];

  return renderEmail({
    to: data.to,
    locale: data.locale,
    subject: fill(content.subject, values),
    name: data.recipientName,
    paragraphs: content.paragraphs.map((p) => fill(p, values)),
    quote: data.status === "cancelled" ? (data.cancelReason ?? undefined) : undefined,
    button: { label: content.button, url: data.url },
    notes: content.notes,
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
