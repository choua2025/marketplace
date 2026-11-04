import { createUploadUrlAction } from "@/server/actions/upload";
import {
  ALLOWED_IMAGE_CONTENT_TYPES,
  MAX_AVATAR_BYTES,
  MAX_OTHER_BYTES,
  type UploadPurpose,
} from "@/lib/validations/upload";

export function maxUploadBytes(purpose: UploadPurpose): number {
  return purpose === "avatar" ? MAX_AVATAR_BYTES : MAX_OTHER_BYTES;
}

/** Same type/size limits the server enforces, checked before uploading so the user gets a clear message. */
export function checkImageFile(
  file: File,
  purpose: UploadPurpose,
): "fileWrongType" | "fileTooLarge" | null {
  if (!(ALLOWED_IMAGE_CONTENT_TYPES as readonly string[]).includes(file.type)) {
    return "fileWrongType";
  }
  if (file.size > maxUploadBytes(purpose)) return "fileTooLarge";
  return null;
}

/** Browser-side half of SPEC.md section 7.9's upload flow: get signed params, then POST straight to Cloudinary. */
export async function uploadFile(
  file: File,
  purpose: UploadPurpose,
  conversationId?: string,
): Promise<string> {
  const signResult = await createUploadUrlAction({
    purpose,
    contentType: file.type,
    contentLength: file.size,
    conversationId,
  });
  if (!signResult.ok) throw new Error(signResult.error);

  const form = new FormData();
  for (const [name, value] of Object.entries(signResult.data.fields)) {
    form.append(name, value);
  }
  form.append("file", file);

  const response = await fetch(signResult.data.uploadUrl, { method: "POST", body: form });
  if (!response.ok) throw new Error("UPLOAD_FAILED");

  return signResult.data.key;
}
