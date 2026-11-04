// Thai (เ แ โ ใ ไ) and Lao (ເ ແ ໂ ໃ ໄ) vowels written before the consonant
// they follow in speech -- "เอก" should show "อ", not "เ".
const LEADING_VOWELS = /^[เ-ไເ-ໄ]+/;

/** One display letter for a name: the first consonant for Thai/Lao, otherwise the uppercased first letter. */
export function nameInitial(name: string): string {
  const first = Array.from(name.trim().replace(LEADING_VOWELS, ""))[0];
  return first ? first.toUpperCase() : "?";
}

/** Stable 0-359 hue for a string, so the same person always gets the same color. */
export function hueFromString(value: string): number {
  const seed = [...value].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7);
  const mixed = Math.imul(seed ^ (seed >>> 16), 0x9e3779b1);
  return ((mixed ^ (mixed >>> 15)) >>> 0) % 360;
}
