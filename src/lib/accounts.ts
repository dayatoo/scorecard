// Input rules for account fields, shared by registration, password change
// and admin reset so every path enforces the same limits. Pure functions, so
// they're unit-testable without a database.

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 32;
export const COMPANY_ID_MAX = 32;
export const PASSWORD_MIN = 8;
/** bcrypt ignores everything past 72 bytes, so a longer password would
 *  silently accept any string sharing its first 72 bytes. */
export const PASSWORD_MAX_BYTES = 72;

const USERNAME_PATTERN = /^[A-Za-z0-9._-]+$/;
const COMPANY_ID_PATTERN = /^[A-Za-z0-9._/-]+$/;

/** Returns an error message, or null when the username is acceptable. */
export function usernameProblem(username: string): string | null {
  if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) {
    return `Usernames must be ${USERNAME_MIN}–${USERNAME_MAX} characters.`;
  }
  if (!USERNAME_PATTERN.test(username)) {
    return "Usernames can only use letters, numbers, dots, dashes and underscores.";
  }
  return null;
}

export function companyIdProblem(companyId: string): string | null {
  if (companyId.length < 1 || companyId.length > COMPANY_ID_MAX) {
    return `Company ID numbers must be 1–${COMPANY_ID_MAX} characters.`;
  }
  if (!COMPANY_ID_PATTERN.test(companyId)) {
    return "Company ID numbers can only use letters, numbers, dots, dashes, slashes and underscores.";
  }
  return null;
}

export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN) {
    return `Passwords must be at least ${PASSWORD_MIN} characters.`;
  }
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) {
    return `Passwords can be at most ${PASSWORD_MAX_BYTES} bytes long.`;
  }
  return null;
}

// No look-alike characters (0/O, 1/l/I), so it can be read out or typed from
// a note without guesswork.
const TEMP_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * A random temporary password for an admin reset, in three dash-separated
 * groups of four (about 70 bits of entropy). Rejection sampling keeps every
 * character equally likely.
 */
export function generateTemporaryPassword(): string {
  const chars: string[] = [];
  const limit = 256 - (256 % TEMP_ALPHABET.length);
  while (chars.length < 12) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    for (const b of bytes) {
      if (b < limit && chars.length < 12) chars.push(TEMP_ALPHABET[b % TEMP_ALPHABET.length]!);
    }
  }
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8, 12)].map((g) => g.join("")).join("-");
}
