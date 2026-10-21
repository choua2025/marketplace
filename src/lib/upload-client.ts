import { createUploadUrlAction } from "@/server/actions/upload";
import type { UploadPurpose } from "@/lib/validations/upload";

/** Browser-side half of SPEC.md section 7.9's upload flow: presign, then PUT directly to storage. */
export async function uploadFile(
  file: File,
  purpose: UploadPurpose,
  conversationId?: string,
): Promise<string> {
  const presignResult = await createUploadUrlAction({
    purpose,
    contentType: file.type,
    contentLength: file.size,
    conversationId,
  });
  if (!presignResult.ok) throw new Error(presignResult.error);

  const putResponse = await fetch(presignResult.data.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!putResponse.ok) throw new Error("UPLOAD_FAILED");

  return presignResult.data.key;
}
