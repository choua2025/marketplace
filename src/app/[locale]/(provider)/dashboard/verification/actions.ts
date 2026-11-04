"use server";

import { getActor } from "@/server/auth/session";
import { submitVerification } from "@/server/services/verification";
import { toActionResult } from "@/server/actions/result";

export async function submitVerificationAction(input: unknown) {
  return toActionResult(async () => submitVerification(await getActor(), input));
}
