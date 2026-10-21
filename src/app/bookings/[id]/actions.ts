"use server";

import { getActor } from "@/server/auth/session";
import { updateBookingStatus } from "@/server/services/booking";
import { toActionResult } from "@/server/actions/result";

export async function updateBookingStatusAction(bookingId: string, input: unknown) {
  return toActionResult(async () => updateBookingStatus(await getActor(), bookingId, input));
}
