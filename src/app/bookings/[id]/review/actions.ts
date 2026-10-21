"use server";

import { getActor } from "@/server/auth/session";
import { createReview, updateReview } from "@/server/services/review";
import { toActionResult } from "@/server/actions/result";

export async function createReviewAction(input: unknown) {
  return toActionResult(async () => createReview(await getActor(), input));
}

export async function updateReviewAction(reviewId: string, input: unknown) {
  return toActionResult(async () => updateReview(await getActor(), reviewId, input));
}
