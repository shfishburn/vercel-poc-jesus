import { describe, expect, it } from "vitest";
import {
  CRISIS_PATTERNS,
  MAX_PRAYER_LENGTH,
  PROFANITY_PATTERNS,
  validatePrayerText,
} from "../../supabase/functions/_shared/community-rules.ts";

describe("validatePrayerText", () => {
  it("accepts a normal prayer and returns it trimmed", () => {
    expect(validatePrayerText("  Please watch over my mother tonight.  ")).toEqual({
      ok: true,
      text: "Please watch over my mother tonight.",
    });
  });

  it("rejects an empty or whitespace-only prayer", () => {
    expect(validatePrayerText("")).toEqual({ ok: false, reason: "empty" });
    expect(validatePrayerText("  \n\t ")).toEqual({ ok: false, reason: "empty" });
  });

  it("rejects 301 characters and accepts 300", () => {
    expect(MAX_PRAYER_LENGTH).toBe(300);
    expect(validatePrayerText("a".repeat(301))).toEqual({ ok: false, reason: "too_long" });
    expect(validatePrayerText("a".repeat(300))).toEqual({ ok: true, text: "a".repeat(300) });
  });

  it("rejects a crisis phrase", () => {
    expect(validatePrayerText("I want to die and nobody would notice")).toEqual({
      ok: false,
      reason: "crisis",
    });
  });

  it("rejects profanity", () => {
    expect(validatePrayerText("Why is everything such shit lately")).toEqual({
      ok: false,
      reason: "profanity",
    });
  });

  it("reports crisis before profanity when both appear", () => {
    expect(validatePrayerText("I feel hopeless and this is shit")).toEqual({
      ok: false,
      reason: "crisis",
    });
  });
});

describe("CRISIS_PATTERNS", () => {
  it("does not match an innocent sentence containing hope", () => {
    expect(CRISIS_PATTERNS.test("I hope my sister finds peace and a job this week.")).toBe(false);
  });

  it("matches hopeless", () => {
    expect(CRISIS_PATTERNS.test("Everything feels hopeless tonight.")).toBe(true);
  });
});

describe("PROFANITY_PATTERNS", () => {
  it("does not match words that merely contain a filtered word", () => {
    expect(PROFANITY_PATTERNS.test("Bless the assistant pastor and the classroom.")).toBe(false);
  });
});
