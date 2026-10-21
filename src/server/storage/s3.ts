import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/server/lib/env";

// WHEN_REQUIRED (not the SDK's newer default WHEN_SUPPORTED) -- otherwise
// the SDK adds an empty-body CRC32 checksum to presigned PUT URLs, which
// Garage (and MinIO) reject with InvalidDigest since the real checksum of
// the uploaded bytes never matches. Same flag will be needed against R2/S3
// in production for the same reason.
const client = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  requestChecksumCalculation: "WHEN_REQUIRED",
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
});

/**
 * Presigned PUT URL for a direct client upload (SPEC.md section 7.9).
 * Binding ContentLength into the signature means a request that uploads a
 * different number of bytes than declared fails signature verification --
 * this is what actually enforces the max-size limits, not just a check at
 * presign time.
 */
export async function createPresignedUploadUrl(
  key: string,
  contentType: string,
  contentLength: number,
  expiresInSeconds = 300,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

/** Signed GET URL for viewing a private object (SPEC.md section 7.9). */
export async function createPresignedViewUrl(
  key: string,
  expiresInSeconds: number,
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}
