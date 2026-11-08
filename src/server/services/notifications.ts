import { db } from "@/server/db/client";
import { env } from "@/server/lib/env";
import { getEmailProvider } from "@/server/email";
import { isLocale, pageUrl, type Locale } from "@/server/email/layout";
import {
  buildBookingStatusEmail,
  buildNewBookingEmail,
  buildNewMessageEmail,
} from "@/server/email/notification-emails";
import { categoryName } from "@/lib/category-name";

/**
 * Email notifications for things that happen while the other person isn't on
 * the site: a new booking request (to the provider), a booking confirmed,
 * completed or cancelled, and a new chat message (to the other party). Fire-and-forget: a slow or failed email never slows
 * down or breaks the action that triggered it -- failures are only logged.
 */

/** Phone sign-ups get a placeholder address that can't receive mail. */
const UNDELIVERABLE_DOMAIN = "@changdee.local";

/**
 * Wait before emailing about a chat message, so someone who reads it in the
 * open chat (within this time) doesn't also get an email.
 */
let messageEmailDelayMs = 60_000;

/** Test-only: skip the wait so tests don't sit for a minute. */
export function setMessageEmailDelayForTesting(ms: number): void {
  if (env.NODE_ENV !== "test") {
    throw new Error("setMessageEmailDelayForTesting can only be used when NODE_ENV=test");
  }
  messageEmailDelayMs = ms;
}

function emailLocale(value: string): Locale {
  return isLocale(value) ? value : "th";
}

function intlLocale(locale: Locale): string {
  return { th: "th-TH", en: "en-GB", lo: "lo-LA" }[locale];
}

function run(kind: string, task: () => Promise<void>): void {
  task().catch((error: unknown) => {
    console.error(
      `[email] ${kind} notification failed:`,
      error instanceof Error ? error.message : error,
    );
  });
}

/** Tells the provider a customer asked for a booking. */
export function notifyNewBooking(bookingId: string): void {
  run("newBooking", async () => {
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        startAt: true,
        category: { select: { nameTh: true, nameEn: true } },
        customer: { select: { fullName: true } },
        provider: {
          select: {
            displayName: true,
            timezone: true,
            profile: { select: { locale: true, user: { select: { email: true } } } },
          },
        },
      },
    });
    if (!booking) return;
    const to = booking.provider.profile.user.email;
    if (to.endsWith(UNDELIVERABLE_DOMAIN)) return;

    const locale = emailLocale(booking.provider.profile.locale);
    const when = new Intl.DateTimeFormat(intlLocale(locale), {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: booking.provider.timezone,
    }).format(booking.startAt);

    await getEmailProvider().send(
      buildNewBookingEmail({
        to,
        locale,
        providerName: booking.provider.displayName,
        customerName: booking.customer.fullName,
        categoryName: categoryName(booking.category, locale),
        when,
        url: pageUrl(env.APP_URL, locale, `/bookings/${booking.id}`),
      }),
    );
  });
}

/**
 * Tells the other party a booking was confirmed, completed or cancelled --
 * or, for "slotTaken", tells a customer their request was cancelled because
 * the provider confirmed someone else for that time. "Started" isn't
 * emailed -- the provider is already on site by then.
 */
export function notifyBookingStatus(
  bookingId: string,
  status: string,
  by: "customer" | "provider",
): void {
  if (
    status !== "confirmed" &&
    status !== "completed" &&
    status !== "cancelled" &&
    status !== "slotTaken"
  ) {
    return;
  }

  run(`booking-${status}`, async () => {
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        providerId: true,
        startAt: true,
        cancelReason: true,
        category: { select: { nameTh: true, nameEn: true } },
        customer: {
          select: { fullName: true, locale: true, user: { select: { email: true } } },
        },
        provider: {
          select: {
            displayName: true,
            timezone: true,
            profile: { select: { locale: true, user: { select: { email: true } } } },
          },
        },
      },
    });
    if (!booking) return;

    const customer = {
      name: booking.customer.fullName,
      locale: booking.customer.locale,
      email: booking.customer.user.email,
    };
    const provider = {
      name: booking.provider.displayName,
      locale: booking.provider.profile.locale,
      email: booking.provider.profile.user.email,
    };
    // Whoever didn't make the change hears about it.
    const [recipient, other] = by === "provider" ? [customer, provider] : [provider, customer];
    if (recipient.email.endsWith(UNDELIVERABLE_DOMAIN)) return;

    const locale = emailLocale(recipient.locale);
    const when = new Intl.DateTimeFormat(intlLocale(locale), {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: booking.provider.timezone,
    }).format(booking.startAt);
    const path =
      status === "completed"
        ? `/bookings/${booking.id}/review`
        : status === "slotTaken"
          ? `/book/${booking.providerId}`
          : `/bookings/${booking.id}`;

    await getEmailProvider().send(
      buildBookingStatusEmail({
        to: recipient.email,
        locale,
        recipientName: recipient.name,
        otherName: other.name,
        categoryName: categoryName(booking.category, locale),
        when,
        status,
        cancelReason: booking.cancelReason,
        url: pageUrl(env.APP_URL, locale, path),
      }),
    );
  });
}

/**
 * Tells the other party about a new chat message -- once per unread streak:
 * if they already have an unread message from the same sender in this
 * conversation, they were emailed about that one, so this one stays quiet
 * until they open the chat. Also skipped if they read it during the delay.
 */
export function notifyNewMessage(messageId: bigint): void {
  run("newMessage", async () => {
    if (messageEmailDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, messageEmailDelayMs));
    }

    const message = await db.message.findUnique({
      where: { id: messageId },
      select: {
        body: true,
        senderId: true,
        readAt: true,
        conversationId: true,
        conversation: {
          select: {
            customerId: true,
            customer: {
              select: { fullName: true, locale: true, user: { select: { email: true } } },
            },
            provider: {
              select: {
                displayName: true,
                profile: { select: { locale: true, user: { select: { email: true } } } },
              },
            },
          },
        },
      },
    });
    if (!message || message.readAt) return;

    const earlierUnread = await db.message.count({
      where: {
        conversationId: message.conversationId,
        senderId: message.senderId,
        readAt: null,
        id: { lt: messageId },
      },
    });
    if (earlierUnread > 0) return;

    const { conversation } = message;
    const fromCustomer = message.senderId === conversation.customerId;
    const recipient = fromCustomer
      ? {
          name: conversation.provider.displayName,
          locale: conversation.provider.profile.locale,
          email: conversation.provider.profile.user.email,
        }
      : {
          name: conversation.customer.fullName,
          locale: conversation.customer.locale,
          email: conversation.customer.user.email,
        };
    if (recipient.email.endsWith(UNDELIVERABLE_DOMAIN)) return;

    const locale = emailLocale(recipient.locale);
    await getEmailProvider().send(
      buildNewMessageEmail({
        to: recipient.email,
        locale,
        recipientName: recipient.name,
        senderName: fromCustomer
          ? conversation.customer.fullName
          : conversation.provider.displayName,
        body: message.body,
        url: pageUrl(env.APP_URL, locale, `/messages/${message.conversationId}`),
      }),
    );
  });
}
