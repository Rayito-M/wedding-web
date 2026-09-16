/**
 * Client-side copies of the two auth TTLs the API enforces — T396.
 *
 * Neither value reaches the client at runtime: the OTP and magic-link
 * request responses carry only `{ ok }` (`OtpRequestedDto`,
 * `MagicLinkRequestedDto`), so the sign-in copy cannot interpolate the
 * server's constant directly. These are the single client-side source for
 * that copy instead — `login.code.sub` and `login.magicLink.sub`
 * interpolate `{{minutes}}` from here, never a second literal in a locale
 * file. That literal was T394's finding: the screen said the code expires
 * in 10 minutes while the API enforced 5 — and TEXTED 5, since the SMS
 * template interpolates `ttlMinutes` from the real constant. The guest saw
 * both numbers at once, during sign-in.
 *
 * What keeps these honest: `e2e/login-ttl.spec.ts` parses the API's own
 * constants off the sibling checkout (`wedding-api` —
 * `sms-verification.service.ts` `CODE_TTL_MINUTES`,
 * `magic-link.service.ts` `TOKEN_TTL_MINUTES`) and fails when either side
 * moves alone. The e2e suite is local-only (`CLAUDE.md` rule 11), so the
 * sibling repo is present wherever the suite actually runs; if it ever is
 * not, the spec skips VISIBLY rather than passing vacuously.
 */
export const OTP_CODE_TTL_MINUTES = 5;

export const MAGIC_LINK_TTL_MINUTES = 15;
