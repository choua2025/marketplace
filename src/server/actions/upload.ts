"use server";

import { getActor } from "@/server/auth/session";
import { createUploadUrl } from "@/server/services/upload";
import { toActionResult } from "./result";

export async function createUploadUrlAction(input: unknown) {
  return toActionResult(async () => createUploadUrl(await getActor(), input));
}
