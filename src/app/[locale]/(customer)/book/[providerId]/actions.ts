"use server";

import { getActor } from "@/server/auth/session";
import { createBooking } from "@/server/services/booking";
import { toActionResult } from "@/server/actions/result";

export async function createBookingAction(input: unknown) {
  return toActionResult(async () => createBooking(await getActor(), input));
}
