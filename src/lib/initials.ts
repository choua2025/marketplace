/** Up to two initials for an avatar fallback, skipping words like "&" that don't start with a letter. */
export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter((part) => /^[\p{L}\p{N}]/u.test(part))
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "?"
  );
}
