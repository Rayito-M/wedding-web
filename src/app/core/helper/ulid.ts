/**
 * A ULID: 26 characters of Crockford base32 — 10 characters of 48-bit
 * millisecond timestamp followed by 16 characters of randomness.
 *
 * The API validates every id it is given against
 * `^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$`, so a `crypto.randomUUID()` is
 * rejected outright: a UUID is 36 characters and its hyphens and `u`/`o`/`i`/
 * `l` are outside the Crockford alphabet. Ids minted client-side for rows the
 * admin has just added (agenda items, hotels, tags, a new person) must be the
 * same shape the backend mints, or the create request fails validation.
 */
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function ulid(now: number = Date.now()): string {
  let time = '';
  for (let t = now, i = 0; i < 10; i++, t = Math.floor(t / 32)) {
    time = CROCKFORD[t % 32] + time;
  }

  let random = '';
  for (const byte of globalThis.crypto.getRandomValues(new Uint8Array(16))) {
    // One byte per character, keeping the low 5 bits: uniform over the alphabet.
    random += CROCKFORD[byte & 31];
  }

  return time + random;
}
