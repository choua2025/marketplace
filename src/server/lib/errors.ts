import th from "../../../messages/th.json";
import en from "../../../messages/en.json";

const MESSAGES = { th, en } as const;
export type Locale = keyof typeof MESSAGES;

export const APP_ERROR_HTTP_STATUS = {
  PROVIDER_UNAVAILABLE: 409,
  CATEGORY_NOT_OFFERED: 409,
  INVALID_START_TIME: 400,
  OUTSIDE_WORKING_HOURS: 409,
  TOO_MANY_PENDING_BOOKINGS: 409,
  BOOKING_NOT_FOUND: 404,
  INVALID_TRANSITION: 409,
  CANCEL_REASON_REQUIRED: 400,
  SLOT_TAKEN: 409,
  CONTACT_LOCKED: 403,
  REVIEW_EXISTS: 409,
  RATE_LIMITED: 429,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  PORTFOLIO_FULL: 409,
} as const satisfies Record<string, number>;

export type AppErrorCode = keyof typeof APP_ERROR_HTTP_STATUS;

/**
 * Standard error class for the service layer (SPEC.md section 5.5).
 * `code` maps to both an HTTP status and a th/en message in messages/.
 */
export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly httpStatus: number;

  constructor(code: AppErrorCode, message?: string) {
    super(message ?? code);
    this.name = "AppError";
    this.code = code;
    this.httpStatus = APP_ERROR_HTTP_STATUS[code];
  }
}

export function translateErrorCode(code: AppErrorCode, locale: Locale): string {
  return MESSAGES[locale].errors[code];
}
