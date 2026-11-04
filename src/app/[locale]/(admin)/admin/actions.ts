"use server";

import { getActor } from "@/server/auth/session";
import { reviewVerification } from "@/server/services/verification";
import { toActionResult } from "@/server/actions/result";

export async function reviewVerificationAction(
  providerId: string,
  decision: { approve: boolean; rejectionReason?: string },
) {
  return toActionResult(async () => reviewVerification(await getActor(), providerId, decision));
}
