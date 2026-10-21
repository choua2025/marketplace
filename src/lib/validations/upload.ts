import { z } from "zod";

// Shared between client forms and the server service (SPEC.md section 4).
export const UPLOAD_PURPOSES = ["avatar", "portfolio", "booking", "chat"] as const;
export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];

export const ALLOWED_IMAGE_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
export const MAX_OTHER_BYTES = 5 * 1024 * 1024;

export const createUploadUrlSchema = z
  .object({
    purpose: z.enum(UPLOAD_PURPOSES),
    contentType: z.enum(ALLOWED_IMAGE_CONTENT_TYPES),
    contentLength: z.number().int().positive(),
    // Chat images are keyed by conversation (both parties must be able to
    // view them), not by the uploader's own id like every other purpose.
    conversationId: z.uuid().optional(),
  })
  .refine(
    (data) =>
      data.contentLength <= (data.purpose === "avatar" ? MAX_AVATAR_BYTES : MAX_OTHER_BYTES),
    {
      message: "File exceeds the maximum allowed size for this upload type.",
      path: ["contentLength"],
    },
  )
  .refine((data) => data.purpose !== "chat" || data.conversationId !== undefined, {
    message: "conversationId is required for chat uploads.",
    path: ["conversationId"],
  });

export type CreateUploadUrlInput = z.infer<typeof createUploadUrlSchema>;
