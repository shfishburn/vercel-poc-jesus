import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { checkRateLimit, getClientIp, getServiceSupabaseClient } from "../_shared/rate-limit.ts";
import {
  type CommunityStore,
  handleCommunityRequest,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  type SessionReaction,
} from "./handler.ts";

const UNIQUE_VIOLATION = "23505";

function fail(context: string, error: { message: string }): never {
  throw new Error(`${context}: ${error.message}`);
}

function createStore(sb: SupabaseClient): CommunityStore {
  return {
    async insertPrayer(text) {
      const { error } = await sb.from("prayer_wall").insert({ prayer_text: text, approved: true });
      if (error) fail("prayer_wall insert", error);
    },

    async insertReaction(prayerId, sessionId, reactionType) {
      const { error } = await sb.from("prayer_wall_reactions").insert({
        prayer_id: prayerId,
        session_id: sessionId,
        reaction_type: reactionType,
      });
      if (!error) return "inserted";
      if (error.code === UNIQUE_VIOLATION) return "already_reacted";
      fail("prayer_wall_reactions insert", error);
    },

    async incrementReaction(prayerId, reactionType) {
      const column = `reactions_${reactionType}` as const;
      const { data, error } = await sb
        .from("prayer_wall")
        .select("reactions_pray, reactions_heart, reactions_leaf, reactions_candle")
        .eq("id", prayerId)
        .maybeSingle();
      if (error) fail("prayer_wall select", error);
      if (!data) throw new Error(`prayer_wall update: prayer ${prayerId} not found`);
      const row: Record<string, unknown> = data;
      const current = Number(row[column]);
      const { error: updateError } = await sb
        .from("prayer_wall")
        .update({ [column]: current + 1 })
        .eq("id", prayerId);
      if (updateError) fail("prayer_wall update", updateError);
    },

    async addVoice(issueId, sessionId) {
      const { data, error } = await sb.rpc("add_prayer_voice", {
        p_issue_id: issueId,
        p_session_id: sessionId,
      });
      if (error) fail("add_prayer_voice", error);
      return data === true;
    },

    async listReactions(sessionId) {
      const { data, error } = await sb
        .from("prayer_wall_reactions")
        .select("prayer_id, reaction_type")
        .eq("session_id", sessionId);
      if (error) fail("prayer_wall_reactions select", error);
      return (data ?? []) as SessionReaction[];
    },

    async listVotes(sessionId) {
      const { data, error } = await sb
        .from("global_prayer_voices")
        .select("issue_id")
        .eq("session_id", sessionId);
      if (error) fail("global_prayer_voices select", error);
      return ((data ?? []) as { issue_id: string }[]).map((row) => row.issue_id);
    },

    async countCandlesSince(since) {
      const { count, error } = await sb
        .from("prayer_wall_reactions")
        .select("*", { count: "exact", head: true })
        .eq("reaction_type", "candle")
        .gte("created_at", since.toISOString());
      if (error) fail("prayer_wall_reactions count", error);
      return count ?? 0;
    },
  };
}

let store: CommunityStore | null = null;

function getStore(): CommunityStore | null {
  if (store) return store;
  const sb = getServiceSupabaseClient();
  if (!sb) return null;
  store = createStore(sb);
  return store;
}

serve((req) =>
  handleCommunityRequest(req, {
    store: getStore(),
    rateLimit: (clientIp) =>
      checkRateLimit({
        scope: "community",
        identifier: clientIp,
        maxRequests: RATE_LIMIT_MAX,
        windowMs: RATE_LIMIT_WINDOW_MS,
      }),
    clientIp: getClientIp,
  })
);
