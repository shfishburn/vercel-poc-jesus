import { describe, expect, it } from "vitest";
import {
  PRAYER_PAGE_STATE_KEY,
  readStoredPrayerState,
  shouldRestorePrayerState,
} from "@/lib/prayerPageState";

const storageWith = (value: string | null): Pick<Storage, "getItem"> => ({
  getItem: (key: string) => (key === PRAYER_PAGE_STATE_KEY ? value : null),
});

describe("shouldRestorePrayerState", () => {
  it("restores on POP (browser back/forward, reload, direct entry)", () => {
    expect(shouldRestorePrayerState("POP")).toBe(true);
  });

  it("starts clean on PUSH (in-app link or button)", () => {
    expect(shouldRestorePrayerState("PUSH")).toBe(false);
  });

  it("starts clean on REPLACE", () => {
    expect(shouldRestorePrayerState("REPLACE")).toBe(false);
  });
});

describe("readStoredPrayerState", () => {
  it("returns the parsed object for valid JSON", () => {
    const state = {
      phase: "response",
      prayer: "Please fix the printer",
      aiResponse: "Have you tried turning it off and on again?",
      closingPrayer: null,
      currentRecordId: "rec-1",
      responseMode: "normal",
    };
    expect(readStoredPrayerState(storageWith(JSON.stringify(state)))).toEqual(state);
  });

  it("returns null when nothing is stored", () => {
    expect(readStoredPrayerState(storageWith(null))).toBeNull();
  });

  it("returns null for malformed JSON instead of throwing", () => {
    expect(readStoredPrayerState(storageWith("{not json"))).toBeNull();
  });

  it("returns null for JSON that is not an object", () => {
    expect(readStoredPrayerState(storageWith("42"))).toBeNull();
    expect(readStoredPrayerState(storageWith("null"))).toBeNull();
  });

  it("reads the key the page writes to", () => {
    sessionStorage.setItem(PRAYER_PAGE_STATE_KEY, JSON.stringify({ phase: "step3" }));
    expect(readStoredPrayerState(sessionStorage)).toEqual({ phase: "step3" });
    sessionStorage.removeItem(PRAYER_PAGE_STATE_KEY);
    expect(readStoredPrayerState(sessionStorage)).toBeNull();
  });
});
