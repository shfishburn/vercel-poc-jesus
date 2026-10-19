export const PRAYER_PAGE_STATE_KEY = "prayerPageState";

export type StoredPrayerState = {
  phase?: string;
  prayer?: string;
  aiResponse?: string;
  closingPrayer?: string | null;
  currentRecordId?: string | null;
  responseMode?: string;
};

export function shouldRestorePrayerState(navigationType: "POP" | "PUSH" | "REPLACE"): boolean {
  return navigationType === "POP";
}

export function readStoredPrayerState(storage: Pick<Storage, "getItem">): StoredPrayerState | null {
  const raw = storage.getItem(PRAYER_PAGE_STATE_KEY);
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  return parsed as StoredPrayerState;
}
