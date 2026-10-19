import { describe, expect, it, vi } from "vitest";
import {
  type CommunityStore,
  handleCommunityRequest,
  type RateLimitDecision,
  startOfTodayUtc,
} from "../../supabase/functions/community/handler.ts";

const PRAYER_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ID = "22222222-2222-4222-8222-222222222222";
const ISSUE_ID = "33333333-3333-4333-8333-333333333333";

function fakeStore(overrides: Partial<CommunityStore> = {}): CommunityStore {
  return {
    insertPrayer: vi.fn(async () => undefined),
    insertReaction: vi.fn(async () => "inserted" as const),
    incrementReaction: vi.fn(async () => undefined),
    addVoice: vi.fn(async () => true),
    listReactions: vi.fn(async () => [{ prayer_id: PRAYER_ID, reaction_type: "candle" }]),
    listVotes: vi.fn(async () => [ISSUE_ID]),
    countCandlesSince: vi.fn(async () => 7),
    ...overrides,
  };
}

const allow = async (): Promise<RateLimitDecision> => ({ limited: false, retryAfterSeconds: 60 });
const block = async (): Promise<RateLimitDecision> => ({ limited: true, retryAfterSeconds: 42 });

function post(body: unknown): Request {
  return new Request("http://localhost/community", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function call(body: unknown, store: CommunityStore | null = fakeStore(), rateLimit = allow) {
  return handleCommunityRequest(post(body), { store, rateLimit, clientIp: () => "203.0.113.9" });
}

describe("handleCommunityRequest", () => {
  it("answers preflight with the CORS headers", async () => {
    const res = await handleCommunityRequest(
      new Request("http://localhost/community", { method: "OPTIONS" }),
      { store: fakeStore(), rateLimit: allow, clientIp: () => "203.0.113.9" },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("returns 429 with Retry-After and touches nothing when rate limited", async () => {
    const store = fakeStore();
    const res = await call({ action: "post_prayer", text: "Peace for everyone." }, store, block);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
    expect(store.insertPrayer).not.toHaveBeenCalled();
  });

  it("returns 503 when the service client is unavailable", async () => {
    const res = await call({ action: "candles_today" }, null);
    expect(res.status).toBe(503);
  });

  it("rejects a non-JSON body and an unknown action with 400", async () => {
    expect((await call("not json")).status).toBe(400);
    const res = await call({ action: "delete_everything" });
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Unknown action." });
  });

  describe("post_prayer", () => {
    it("inserts a trimmed, approved prayer", async () => {
      const store = fakeStore();
      const res = await call({ action: "post_prayer", text: "  Keep my brother safe.  " }, store);
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({ ok: true });
      expect(store.insertPrayer).toHaveBeenCalledWith("Keep my brother safe.");
    });

    it("returns 422 crisis and does not insert", async () => {
      const store = fakeStore();
      const res = await call({ action: "post_prayer", text: "I want to die" }, store);
      expect(res.status).toBe(422);
      await expect(res.json()).resolves.toEqual({ error: "crisis" });
      expect(store.insertPrayer).not.toHaveBeenCalled();
    });

    it("returns 422 profanity and does not insert", async () => {
      const store = fakeStore();
      const res = await call({ action: "post_prayer", text: "this is shit" }, store);
      expect(res.status).toBe(422);
      await expect(res.json()).resolves.toEqual({ error: "profanity" });
      expect(store.insertPrayer).not.toHaveBeenCalled();
    });

    it("returns 400 for empty, missing, and over-long text", async () => {
      const store = fakeStore();
      expect((await call({ action: "post_prayer", text: "   " }, store)).status).toBe(400);
      expect((await call({ action: "post_prayer" }, store)).status).toBe(400);
      expect((await call({ action: "post_prayer", text: "x".repeat(301) }, store)).status).toBe(
        400,
      );
      expect(store.insertPrayer).not.toHaveBeenCalled();
    });
  });

  describe("react", () => {
    it("inserts the reaction and increments the counter", async () => {
      const store = fakeStore();
      const res = await call(
        { action: "react", prayerId: PRAYER_ID, reactionType: "candle", sessionId: SESSION_ID },
        store,
      );
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({ ok: true });
      expect(store.insertReaction).toHaveBeenCalledWith(PRAYER_ID, SESSION_ID, "candle");
      expect(store.incrementReaction).toHaveBeenCalledWith(PRAYER_ID, "candle");
    });

    it("reports already_reacted on a duplicate and does not increment", async () => {
      const store = fakeStore({ insertReaction: vi.fn(async () => "already_reacted" as const) });
      const res = await call(
        { action: "react", prayerId: PRAYER_ID, reactionType: "heart", sessionId: SESSION_ID },
        store,
      );
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({ ok: false, reason: "already_reacted" });
      expect(store.incrementReaction).not.toHaveBeenCalled();
    });

    it("rejects an unknown reaction type and a malformed id with 400", async () => {
      const store = fakeStore();
      const badType = await call(
        { action: "react", prayerId: PRAYER_ID, reactionType: "fire", sessionId: SESSION_ID },
        store,
      );
      expect(badType.status).toBe(400);
      const badId = await call(
        { action: "react", prayerId: "1 OR 1=1", reactionType: "pray", sessionId: SESSION_ID },
        store,
      );
      expect(badId.status).toBe(400);
      expect(store.insertReaction).not.toHaveBeenCalled();
    });

    it("surfaces a store failure as 500 without a body echo", async () => {
      const store = fakeStore({
        incrementReaction: vi.fn(async () => {
          throw new Error("prayer_wall update: boom");
        }),
      });
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const res = await call(
        { action: "react", prayerId: PRAYER_ID, reactionType: "leaf", sessionId: SESSION_ID },
        store,
      );
      errorSpy.mockRestore();
      expect(res.status).toBe(500);
      await expect(res.json()).resolves.toEqual({
        error: "An unexpected error occurred. Please try again.",
      });
    });
  });

  describe("vote", () => {
    it("adds a voice and returns added", async () => {
      const store = fakeStore();
      const res = await call({ action: "vote", issueId: ISSUE_ID, sessionId: SESSION_ID }, store);
      await expect(res.json()).resolves.toEqual({ ok: true, added: true });
      expect(store.addVoice).toHaveBeenCalledWith(ISSUE_ID, SESSION_ID);
    });

    it("returns added false when the session already voted", async () => {
      const store = fakeStore({ addVoice: vi.fn(async () => false) });
      const res = await call({ action: "vote", issueId: ISSUE_ID, sessionId: SESSION_ID }, store);
      await expect(res.json()).resolves.toEqual({ ok: true, added: false });
    });

    it("rejects a malformed session id with 400", async () => {
      const store = fakeStore();
      const res = await call({ action: "vote", issueId: ISSUE_ID, sessionId: "me" }, store);
      expect(res.status).toBe(400);
      expect(store.addVoice).not.toHaveBeenCalled();
    });
  });

  describe("reads", () => {
    it("returns the session's reactions and votes", async () => {
      await expect(
        (await call({ action: "my_reactions", sessionId: SESSION_ID })).json(),
      ).resolves.toEqual({ reactions: [{ prayer_id: PRAYER_ID, reaction_type: "candle" }] });
      await expect(
        (await call({ action: "my_votes", sessionId: SESSION_ID })).json(),
      ).resolves.toEqual({ issueIds: [ISSUE_ID] });
    });

    it("refuses reads for a malformed session id", async () => {
      expect((await call({ action: "my_reactions", sessionId: "*" })).status).toBe(400);
      expect((await call({ action: "my_votes" })).status).toBe(400);
    });

    it("counts candles since midnight UTC", async () => {
      const store = fakeStore();
      const res = await call({ action: "candles_today" }, store);
      await expect(res.json()).resolves.toEqual({ count: 7 });
      const since = vi.mocked(store.countCandlesSince).mock.calls[0][0];
      expect(since.toISOString()).toMatch(/T00:00:00\.000Z$/);
      expect(since.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });
});

describe("startOfTodayUtc", () => {
  it("drops the time of day in UTC", () => {
    expect(startOfTodayUtc(new Date("2026-10-19T23:59:59.999Z")).toISOString()).toBe(
      "2026-10-19T00:00:00.000Z",
    );
    expect(startOfTodayUtc(new Date("2026-10-19T00:00:00.000Z")).toISOString()).toBe(
      "2026-10-19T00:00:00.000Z",
    );
  });
});
