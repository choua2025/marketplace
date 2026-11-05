/** Where Google serves profile pictures; also allowed in the CSP's img-src (src/proxy.ts). */
export const GOOGLE_PHOTO_IMG_SRC = "https://lh3.googleusercontent.com";

/**
 * True for a Google profile-picture URL. Only these are ever stored in
 * `profiles.avatar_key` instead of an upload key -- `user.image` can be set
 * by the user, so anything else is ignored rather than shown.
 */
export function isGooglePhotoUrl(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(`${GOOGLE_PHOTO_IMG_SRC}/`);
}
