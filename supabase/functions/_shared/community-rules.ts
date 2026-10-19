export const MAX_PRAYER_LENGTH = 300;

export const PROFANITY_PATTERNS =
  /\b(fuck|shit|damn|ass|bitch|cunt|dick|cock|pussy|nigger|faggot|retard)\b/i;

export const CRISIS_PATTERNS =
  /\b(kill\s*(my|him|her|them)?self|end\s*my\s*life|want\s*to\s*die|suicid\w*|self[- ]?harm|no\s*reason\s*to\s*live|hopeless)\b/i;

export type PrayerTextRejection = "empty" | "too_long" | "crisis" | "profanity";

export type PrayerTextResult =
  | { ok: true; text: string }
  | { ok: false; reason: PrayerTextRejection };

export function validatePrayerText(text: string): PrayerTextResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, reason: "empty" };
  if (trimmed.length > MAX_PRAYER_LENGTH) return { ok: false, reason: "too_long" };
  if (CRISIS_PATTERNS.test(trimmed)) return { ok: false, reason: "crisis" };
  if (PROFANITY_PATTERNS.test(trimmed)) return { ok: false, reason: "profanity" };
  return { ok: true, text: trimmed };
}
