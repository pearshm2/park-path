/**
 * The rules for a new password (signing up, or changing it in Settings),
 * the same as the API's (api/app/schemas.py `_check_new_password`), so the
 * message shows before anything is sent.
 *
 * Why a maximum: the server stores passwords with bcrypt, which only reads
 * the first 72 bytes and silently ignores the rest. Bytes, not letters: an
 * accented letter takes 2 and an emoji 4, so a password of emoji reaches
 * the limit in 18.
 *
 * Signing in has no rules: an existing password is whatever it is.
 */

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_BYTES = 72;

/** How many bytes `text` takes in UTF-8, the way the server counts it. */
export function utf8Length(text: string): number {
  let bytes = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}

/** What's wrong with a new password, or null if it's fine. */
export function newPasswordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (utf8Length(password) > MAX_PASSWORD_BYTES) {
    return `Use at most ${MAX_PASSWORD_BYTES} characters (emoji and accented letters count as more than one).`;
  }
  return null;
}
