import { v2 as cloudinary } from "cloudinary";
import { env } from "@/server/lib/env";

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`;
const ALLOWED_FORMATS = "jpg,png,webp";
// Applied on upload: caps stored images at 2048px so an oversized photo
// can't sit in storage at full size. (Signed uploads can't bind a byte
// limit the way S3 presigned PUTs could.)
const INCOMING_TRANSFORMATION = "c_limit,w_2048,h_2048";

// Keys stored in the DB look like "avatar/<userId>/<uuid>.jpg". Cloudinary
// keeps the format separately from the public id, and everything lives
// under one folder so the app's files don't mix with the rest of the account.
function toPublicId(key: string): string {
  return `${env.CLOUDINARY_FOLDER}/${key.replace(/\.[^./]+$/, "")}`;
}

function formatOf(key: string): string {
  return key.slice(key.lastIndexOf(".") + 1);
}

/**
 * Signed parameters for a direct browser upload. The signature covers the
 * public id, so the browser can only upload to the exact key the server
 * issued -- and only as a private ("authenticated") asset.
 */
export function createSignedUpload(key: string): {
  uploadUrl: string;
  fields: Record<string, string>;
} {
  const params = {
    public_id: toPublicId(key),
    type: "authenticated",
    allowed_formats: ALLOWED_FORMATS,
    transformation: INCOMING_TRANSFORMATION,
    overwrite: "false",
    timestamp: String(Math.round(Date.now() / 1000)),
  };
  const signature = cloudinary.utils.api_sign_request(params, env.CLOUDINARY_API_SECRET);
  return {
    uploadUrl: UPLOAD_URL,
    fields: { ...params, api_key: env.CLOUDINARY_API_KEY, signature },
  };
}

/** Permanent signed CDN URL -- for images already shown publicly (avatars, portfolio). */
export function createSignedViewUrl(key: string): string {
  return cloudinary.url(toPublicId(key), {
    type: "authenticated",
    sign_url: true,
    format: formatOf(key),
    secure: true,
  });
}

/** Time-limited URL -- for private files (booking/chat photos, verification documents). */
export function createExpiringViewUrl(key: string, expiresInSeconds: number): string {
  return cloudinary.utils.private_download_url(toPublicId(key), formatOf(key), {
    type: "authenticated",
    expires_at: Math.round(Date.now() / 1000) + expiresInSeconds,
    attachment: false,
  });
}
