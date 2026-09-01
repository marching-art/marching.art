// Client mirror of functions/src/helpers/ageGate.js — the sign-up form
// screens the date of birth before the account exists; createUserProfile
// re-validates and records it. A parity test pins the two.

export const MIN_AGE_YEARS = 13;
const BIRTH_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseBirthDate(value: unknown, now: Date = new Date()): Date | null {
  if (typeof value !== 'string') return null;
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

export function ageInYears(birthDate: Date, now: Date = new Date()): number {
  let years = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < birthDate.getUTCMonth() ||
    (now.getUTCMonth() === birthDate.getUTCMonth() && now.getUTCDate() < birthDate.getUTCDate());
  if (beforeBirthday) years -= 1;
  return years;
}

export type BirthDateCheck =
  { ok: true; birthDate: string; age: number } | { ok: false; reason: 'invalid' | 'underage' };

export function checkBirthDate(value: unknown, now: Date = new Date()): BirthDateCheck {
  const parsed = parseBirthDate(value, now);
  if (!parsed) return { ok: false, reason: 'invalid' };
  const age = ageInYears(parsed, now);
  if (age < MIN_AGE_YEARS) return { ok: false, reason: 'underage' };
  return { ok: true, birthDate: parsed.toISOString().slice(0, 10), age };
}

/** Latest birth date that satisfies the minimum age today (for the input's max). */
export function latestEligibleBirthDate(now: Date = new Date()): string {
  const d = new Date(
    Date.UTC(now.getUTCFullYear() - MIN_AGE_YEARS, now.getUTCMonth(), now.getUTCDate())
  );
  return d.toISOString().slice(0, 10);
}

// Sign-up collects the date before the profile exists; onboarding hands it
// to createUserProfile. Per-tab storage bridges the two pages.
const STASH_KEY = 'ma:birthDate';

export function stashBirthDate(birthDate: string): void {
  try {
    sessionStorage.setItem(STASH_KEY, birthDate);
  } catch {
    /* storage unavailable — the server treats a missing date as "not attested" */
  }
}

export function takeStashedBirthDate(): string | null {
  try {
    const value = sessionStorage.getItem(STASH_KEY);
    return value || null;
  } catch {
    return null;
  }
}

export function clearStashedBirthDate(): void {
  try {
    sessionStorage.removeItem(STASH_KEY);
  } catch {
    /* nothing to clear */
  }
}
