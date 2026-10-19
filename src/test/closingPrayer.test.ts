import { describe, expect, it } from "vitest";
import { describeClosingPrayerError } from "@/lib/closingPrayer";

describe("describeClosingPrayerError", () => {
  it("names a timeout", () => {
    expect(describeClosingPrayerError("timeout")).toMatch(/timed out/);
  });

  it("names an empty answer", () => {
    expect(describeClosingPrayerError("empty")).toMatch(/silence/);
  });

  it("carries the upstream status through", () => {
    expect(describeClosingPrayerError("upstream_429")).toMatch(/status 429/);
  });

  it("falls back to a generic line for an unknown code", () => {
    expect(describeClosingPrayerError("something_new")).toBe(
      "The closing prayer line did not answer.",
    );
  });
});
