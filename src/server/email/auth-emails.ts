import { getEmailProvider, type EmailMessage } from "./index";
import { EMAIL_MESSAGES, isLocale, renderEmail, type Locale } from "./layout";

export type { Locale } from "./layout";
/** `useGoogle` answers a password-reset request for an account that signs in with Google only. */
export type AuthEmailKind = "verifyEmail" | "resetPassword" | "useGoogle";

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

export function buildAuthEmail(
  kind: AuthEmailKind,
  data: { to: string; name: string; url: string; locale: Locale },
): EmailMessage {
  const m = EMAIL_MESSAGES[data.locale].email;
  const copy = {
    verifyEmail: {
      subject: m.verifySubject,
      intro: m.verifyIntro,
      button: m.verifyButton,
      expiry: m.verifyExpiry,
    },
    resetPassword: {
      subject: m.resetSubject,
      intro: m.resetIntro,
      button: m.resetButton,
      expiry: m.resetExpiry,
    },
    // A plain link to the login page: nothing expires.
    useGoogle: {
      subject: m.googleSubject,
      intro: m.googleIntro,
      button: m.googleButton,
      expiry: "",
    },
  }[kind];

  return renderEmail({
    to: data.to,
    locale: data.locale,
    subject: copy.subject,
    name: data.name,
    paragraphs: [copy.intro],
    button: { label: copy.button, url: data.url },
    notes: [copy.expiry],
    footer: m.ignoreNote,
  });
}

/**
 * Not awaited by callers on purpose: answering at the same speed whether or
 * not an account exists keeps response timing from revealing which emails
 * are registered. Failures are logged instead of surfaced.
 */
export function sendAuthEmail(
  kind: AuthEmailKind,
  user: { email: string; name: string },
  /** A fixed link, or one built for the email's language (e.g. the localized login page). */
  url: string | ((locale: Locale) => string),
  request?: Request,
): void {
  const logFailure = (error: unknown) => {
    console.error(`[email] ${kind} email failed:`, error instanceof Error ? error.message : error);
  };
  const locale = localeFromRequest(request);
  const message = buildAuthEmail(kind, {
    to: user.email,
    name: user.name,
    url: typeof url === "string" ? url : url(locale),
    locale,
  });
  try {
    getEmailProvider().send(message).catch(logFailure);
  } catch (error) {
    // e.g. email not configured in production -- same response either way.
    logFailure(error);
  }
}
