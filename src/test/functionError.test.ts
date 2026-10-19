import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { getErrorInfo } from "@/components/ErrorScreen";
import { functionErrorMessage } from "@/lib/functionError";

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("functionErrorMessage", () => {
  it("surfaces the server's own error text from a non-2xx response", async () => {
    const error = new FunctionsHttpError(
      jsonResponse(429, { error: "The lines are busy. Please wait a moment before trying again." }),
    );
    await expect(functionErrorMessage(error)).resolves.toBe(
      "The lines are busy. Please wait a moment before trying again.",
    );
  });

  it("falls back to the status when the body is not JSON", async () => {
    const error = new FunctionsHttpError(new Response("<html>gateway</html>", { status: 502 }));
    await expect(functionErrorMessage(error)).resolves.toBe("Edge Function returned status 502");
  });

  it("keeps the library message when the request never reached the function", async () => {
    const error = new FunctionsFetchError(new TypeError("Failed to fetch"));
    await expect(functionErrorMessage(error)).resolves.toBe(
      "Failed to send a request to the Edge Function",
    );
  });

  it("uses a plain Error's message", async () => {
    await expect(functionErrorMessage(new Error("boom"))).resolves.toBe("boom");
  });
});

describe("getErrorInfo mapping of pray function messages", () => {
  it("maps the 429 body to the rate-limit screen", () => {
    expect(
      getErrorInfo("The lines are busy. Please wait a moment before trying again.").title,
    ).toBe("Slow Down, Pilgrim");
  });

  it("maps a failed send to the network screen", () => {
    expect(getErrorInfo("Failed to send a request to the Edge Function").title).toBe("Signal Lost");
  });

  it("maps the 503 and 402 bodies to the maintenance screen", () => {
    expect(
      getErrorInfo("The hotline is temporarily unavailable. Please try again later.").title,
    ).toBe("Heavenly Maintenance");
    expect(getErrorInfo("The hotline has exceeded its budget. Please try again later.").title).toBe(
      "Heavenly Maintenance",
    );
  });

  it("still leaves unknown text on the default screen", () => {
    expect(getErrorInfo("An unexpected error occurred. Please try again.").title).toBe(
      "Something Went Wrong",
    );
  });
});
