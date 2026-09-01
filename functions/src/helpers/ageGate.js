// Age screening shared by createUserProfile (server) and mirrored on the
// client in src/utils/ageGate.ts (a parity test pins the two).
//
// The Terms require directors to be at least 13, and the audience of a
// marching-arts game skews high-school — but nothing in the sign-up flow
// asked. A date of birth (not a checkbox) is the neutral attestation: the
// server validates it and records it on the owner-only private doc.

const MIN_AGE_YEARS = 13;
const BIRTH_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parse a YYYY-MM-DD birth date into a UTC Date, or null when malformed,
 * impossible (Feb 30), in the future, or implausibly old.
 * @param {unknown} value
 * @param {Date} [now]
 * @returns {Date|null}
 */
function parseBirthDate(value, now = new Date()) {
  if (typeof value !== "string") return null;
  const m = BIRTH_DATE_RE.exec(value.trim());
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }
  if (d.getTime() > now.getTime()) return null;
  if (year < now.getUTCFullYear() - 120) return null;
  return d;
}

/**
 * Whole years between a birth date and now (UTC calendar arithmetic).
 * @param {Date} birthDate
 * @param {Date} [now]
 */
function ageInYears(birthDate, now = new Date()) {
  let years = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < birthDate.getUTCMonth() ||
    (now.getUTCMonth() === birthDate.getUTCMonth() && now.getUTCDate() < birthDate.getUTCDate());
  if (beforeBirthday) years -= 1;
  return years;
}

/**
 * @param {unknown} value YYYY-MM-DD
 * @param {Date} [now]
 * @returns {{ ok: true, birthDate: string, age: number } | { ok: false, reason: "invalid" | "underage" }}
 */
function checkBirthDate(value, now = new Date()) {
  const parsed = parseBirthDate(value, now);
  if (!parsed) return { ok: false, reason: "invalid" };
  const age = ageInYears(parsed, now);
  if (age < MIN_AGE_YEARS) return { ok: false, reason: "underage" };
  return { ok: true, birthDate: parsed.toISOString().slice(0, 10), age };
}

module.exports = { MIN_AGE_YEARS, parseBirthDate, ageInYears, checkBirthDate };
