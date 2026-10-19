import {
  MAX_PRAYER_LENGTH,
  type PrayerTextRejection,
  validatePrayerText,
} from "../_shared/community-rules.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX = 20;

export const REACTION_TYPES = ["pray", "heart", "leaf", "candle"] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];

export interface SessionReaction {
  prayer_id: string;
  reaction_type: string;
}

export interface CommunityStore {
  insertPrayer(text: string): Promise<void>;
  insertReaction(
    prayerId: string,
    sessionId: string,
    reactionType: ReactionType,
  ): Promise<"inserted" | "already_reacted">;
  incrementReaction(prayerId: string, reactionType: ReactionType): Promise<void>;
  addVoice(issueId: string, sessionId: string): Promise<boolean>;
  listReactions(sessionId: string): Promise<SessionReaction[]>;
  listVotes(sessionId: string): Promise<string[]>;
  countCandlesSince(since: Date): Promise<number>;
}

export interface RateLimitDecision {
  limited: boolean;
  retryAfterSeconds: number;
}

export interface CommunityDeps {
  store: CommunityStore | null;
  rateLimit(clientIp: string): Promise<RateLimitDecision>;
  clientIp(req: Request): string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PRAYER_REJECTIONS: Record<PrayerTextRejection, { status: number; error: string }> = {
  empty: { status: 400, error: "Please write a prayer first." },
  too_long: { status: 400, error: `Keep it under ${MAX_PRAYER_LENGTH} characters.` },
  crisis: { status: 422, error: "crisis" },
  profanity: { status: 422, error: "profanity" },
};

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isReactionType(value: unknown): value is ReactionType {
  return typeof value === "string" && (REACTION_TYPES as readonly string[]).includes(value);
}

export function startOfTodayUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function postPrayer(store: CommunityStore, body: Record<string, unknown>): Promise<Response> {
  const text = typeof body.text === "string" ? body.text : "";
  const result = validatePrayerText(text);
  if (result.ok === false) {
    const rejection = PRAYER_REJECTIONS[result.reason];
    return json({ error: rejection.error }, rejection.status);
  }
  await store.insertPrayer(result.text);
  return json({ ok: true });
}

async function react(store: CommunityStore, body: Record<string, unknown>): Promise<Response> {
  const { prayerId, reactionType, sessionId } = body;
  if (!isUuid(prayerId) || !isUuid(sessionId)) {
    return json({ error: "Invalid id." }, 400);
  }
  if (!isReactionType(reactionType)) {
    return json({ error: "Invalid reaction." }, 400);
  }
  const outcome = await store.insertReaction(prayerId, sessionId, reactionType);
  if (outcome === "already_reacted") {
    return json({ ok: false, reason: "already_reacted" });
  }
  await store.incrementReaction(prayerId, reactionType);
  return json({ ok: true });
}

async function vote(store: CommunityStore, body: Record<string, unknown>): Promise<Response> {
  const { issueId, sessionId } = body;
  if (!isUuid(issueId) || !isUuid(sessionId)) {
    return json({ error: "Invalid id." }, 400);
  }
  const added = await store.addVoice(issueId, sessionId);
  return json({ ok: true, added });
}

async function myReactions(
  store: CommunityStore,
  body: Record<string, unknown>,
): Promise<Response> {
  const { sessionId } = body;
  if (!isUuid(sessionId)) {
    return json({ error: "Invalid id." }, 400);
  }
  return json({ reactions: await store.listReactions(sessionId) });
}

async function myVotes(store: CommunityStore, body: Record<string, unknown>): Promise<Response> {
  const { sessionId } = body;
  if (!isUuid(sessionId)) {
    return json({ error: "Invalid id." }, 400);
  }
  return json({ issueIds: await store.listVotes(sessionId) });
}

async function candlesToday(store: CommunityStore): Promise<Response> {
  return json({ count: await store.countCandlesSince(startOfTodayUtc(new Date())) });
}

export async function handleCommunityRequest(req: Request, deps: CommunityDeps): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimit = await deps.rateLimit(deps.clientIp(req));
  if (rateLimit.limited) {
    return json({ error: "The lines are busy. Please wait a moment before trying again." }, 429, {
      "Retry-After": String(rateLimit.retryAfterSeconds),
    });
  }

  const store = deps.store;
  if (!store) {
    return json(
      { error: "Community features are temporarily unavailable. Please try again later." },
      503,
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json({ error: "Request body must be JSON." }, 400);
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return json({ error: "Request body must be a JSON object." }, 400);
  }
  const body = raw as Record<string, unknown>;

  try {
    switch (body.action) {
      case "post_prayer":
        return await postPrayer(store, body);
      case "react":
        return await react(store, body);
      case "vote":
        return await vote(store, body);
      case "my_reactions":
        return await myReactions(store, body);
      case "my_votes":
        return await myVotes(store, body);
      case "candles_today":
        return await candlesToday(store);
      default:
        return json({ error: "Unknown action." }, 400);
    }
  } catch (error) {
    console.error("community error:", error);
    return json({ error: "An unexpected error occurred. Please try again." }, 500);
  }
}
