import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { checkRateLimit, getClientIp } from "../_shared/rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// --- Server-side rate limiting (Supabase-backed with memory fallback) ---
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10; // max requests per window per IP
const ELEVENLABS_TIMEOUT_MS = 15_000;
const ELEVENLABS_MAX_RETRIES = 2;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

async function fetchWithTimeoutAndRetry(
  input: string,
  init: RequestInit,
  timeoutMs: number,
  maxRetries: number,
): Promise<Response> {
  let attempt = 0;

  while (true) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(input, { ...init, signal: controller.signal });
      if (!shouldRetryStatus(response.status) || attempt >= maxRetries) {
        return response;
      }
    } catch (error) {
      if (attempt >= maxRetries) {
        throw error;
      }
    } finally {
      clearTimeout(timeoutId);
    }

    attempt += 1;
    await delay(250 * attempt);
  }
}

interface VoiceProfile {
  voiceId: string;
  stability: number;
  style: number;
  similarityBoost: number;
  pickupLine: string;
}

const VOICE_MAP: Record<string, VoiceProfile> = {
  // Christianity
  "christianity:general": {
    voiceId: "JBFqnCBsd6RMkjVDRZzb",
    stability: 0.65,
    style: 0.25,
    similarityBoost: 0.75,
    pickupLine: "NT Customer Care here — go ahead.",
  },
  "christianity:old-testament": {
    voiceId: "nPczCjzI2devNBz1zQrb",
    stability: 0.5,
    style: 0.6,
    similarityBoost: 0.75,
    pickupLine: "Old Testament Complaints Desk. Your lament has been received.",
  },
  "christianity:saints": {
    voiceId: "JBFqnCBsd6RMkjVDRZzb",
    stability: 0.6,
    style: 0.3,
    similarityBoost: 0.75,
    pickupLine: "Saints Help Desk — which patron are we looking for today?",
  },
  "christianity:spiritual-warfare": {
    voiceId: "nPczCjzI2devNBz1zQrb",
    stability: 0.55,
    style: 0.5,
    similarityBoost: 0.75,
    pickupLine: "Hard Questions Desk here. We can work through this.",
  },
  "judaism:general": {
    voiceId: "JBFqnCBsd6RMkjVDRZzb",
    stability: 0.6,
    style: 0.35,
    similarityBoost: 0.75,
    pickupLine: "Covenant Line, shalom. How can we help?",
  },
  "judaism:talmud": {
    voiceId: "cjVigY5qzO86Huf0OWal",
    stability: 0.6,
    style: 0.4,
    similarityBoost: 0.75,
    pickupLine: "Talmudic Debates desk. There are, of course, two opinions on this already.",
  },
  "judaism:bubbe": {
    voiceId: "cgSgspJ2msm6clMCkdW9",
    stability: 0.45,
    style: 0.5,
    similarityBoost: 0.75,
    pickupLine: "Bubbe speaking, darling. What's troubling you?",
  },
  "judaism:spiritual-warfare": {
    voiceId: "nPczCjzI2devNBz1zQrb",
    stability: 0.55,
    style: 0.45,
    similarityBoost: 0.75,
    pickupLine: "Inner Struggle Desk here. Nu, let's wrestle with it.",
  },
  "islam:general": {
    voiceId: "JBFqnCBsd6RMkjVDRZzb",
    stability: 0.65,
    style: 0.25,
    similarityBoost: 0.75,
    pickupLine: "Assalamu alaikum. Mercy Line, go ahead.",
  },
  "islam:fiqh": {
    voiceId: "cjVigY5qzO86Huf0OWal",
    stability: 0.7,
    style: 0.2,
    similarityBoost: 0.75,
    pickupLine: "Fiqh Helpline. State your question with intention.",
  },
  "islam:sufi": {
    voiceId: "SAz9YHcvj6GT2YYXdXww",
    stability: 0.55,
    style: 0.5,
    similarityBoost: 0.75,
    pickupLine: "Sufi desk. Speak your heart.",
  },
  "islam:spiritual-warfare": {
    voiceId: "nPczCjzI2devNBz1zQrb",
    stability: 0.55,
    style: 0.45,
    similarityBoost: 0.75,
    pickupLine: "Whispers and Doubt Desk here. We hear you.",
  },
  "hinduism:general": {
    voiceId: "JBFqnCBsd6RMkjVDRZzb",
    stability: 0.6,
    style: 0.3,
    similarityBoost: 0.75,
    pickupLine: "Namaste. Karma Helpline, how may we guide you?",
  },
  "hinduism:karma": {
    voiceId: "cjVigY5qzO86Huf0OWal",
    stability: 0.65,
    style: 0.3,
    similarityBoost: 0.75,
    pickupLine: "Karma Accounting. Let's look at your balance.",
  },
  "hinduism:bhakti": {
    voiceId: "SAz9YHcvj6GT2YYXdXww",
    stability: 0.5,
    style: 0.45,
    similarityBoost: 0.75,
    pickupLine: "Bhakti Devotion desk. Your love has been felt.",
  },
  "hinduism:spiritual-warfare": {
    voiceId: "nPczCjzI2devNBz1zQrb",
    stability: 0.55,
    style: 0.5,
    similarityBoost: 0.75,
    pickupLine: "Darkness and Dharma Desk. We'll face this with you.",
  },
  "buddhism:general": {
    voiceId: "Xb7hH8MSUJpSbSDYk0k2",
    stability: 0.8,
    style: 0.15,
    similarityBoost: 0.75,
    pickupLine: "Zen desk. I'm listening.",
  },
  "buddhism:zen": {
    voiceId: "Xb7hH8MSUJpSbSDYk0k2",
    stability: 0.85,
    style: 0.1,
    similarityBoost: 0.75,
    pickupLine: "Zen Koans desk. Before you ask — who is asking?",
  },
  "buddhism:metta": {
    voiceId: "Xb7hH8MSUJpSbSDYk0k2",
    stability: 0.75,
    style: 0.2,
    similarityBoost: 0.75,
    pickupLine: "Metta Meditation. May you be well.",
  },
  "buddhism:spiritual-warfare": {
    voiceId: "Xb7hH8MSUJpSbSDYk0k2",
    stability: 0.7,
    style: 0.25,
    similarityBoost: 0.75,
    pickupLine: "Illusion and Clarity Desk. The illusion is noted.",
  },
  "secular:general": {
    voiceId: "onwK4e9ZLuTAKqWW03F9",
    stability: 0.6,
    style: 0.35,
    similarityBoost: 0.75,
    pickupLine: "Cosmic Support online. What question drifts your way?",
  },
  "secular:stoic": {
    voiceId: "cjVigY5qzO86Huf0OWal",
    stability: 0.7,
    style: 0.2,
    similarityBoost: 0.75,
    pickupLine: "Stoic Support. State your concern.",
  },
  "secular:existential": {
    voiceId: "onwK4e9ZLuTAKqWW03F9",
    stability: 0.55,
    style: 0.4,
    similarityBoost: 0.75,
    pickupLine: "Existential Help desk. What question drifts your way?",
  },
  "secular:spiritual-warfare": {
    voiceId: "onwK4e9ZLuTAKqWW03F9",
    stability: 0.6,
    style: 0.3,
    similarityBoost: 0.75,
    pickupLine: "Cognitive Clarity Desk here. Let's examine the evidence.",
  },
};

const DEFAULT_VOICE: VoiceProfile = {
  voiceId: "XrExE9yKIg1WjnnlVkGX",
  stability: 0.55,
  style: 0.4,
  similarityBoost: 0.75,
  pickupLine: "Heavenly Support Center, how can we help?",
};

/** ElevenLabs error bodies carry a machine code at detail.status (e.g. "quota_exceeded"). */
function providerErrorCode(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { detail?: { status?: unknown } | string };
    if (typeof parsed.detail === "string") return parsed.detail;
    return typeof parsed.detail?.status === "string" ? parsed.detail.status : null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const clientIp = getClientIp(req);
    const rateLimit = await checkRateLimit({
      scope: "tts",
      identifier: clientIp,
      maxRequests: RATE_LIMIT_MAX,
      windowMs: RATE_LIMIT_WINDOW_MS,
    });

    if (rateLimit.limited) {
      return new Response(JSON.stringify({ error: "Too many requests. Please wait a moment." }), {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      });
    }

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      console.error("Missing required API key for TTS service");
      return new Response(JSON.stringify({ error: "TTS service is temporarily unavailable." }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { text, department, faith, type } = await req.json();

    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "Missing text" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Limit text length for cost safety
    const truncatedText = text.slice(0, 4000);

    // For closing prayers, use a calm, reverent voice with faith-specific intro
    const isPrayer = type === "prayer";
    const key = `${faith}:${department}`;

    const PRAYER_INTROS: Record<string, string> = {
      christianity: "Let us bow our heads and pray.",
      islam: "Bismillah ir-Rahman ir-Rahim. Let us make dua.",
      judaism: "Let us offer a prayer together.",
      hinduism: "Let us join in prayer. Om.",
      buddhism: "Let us sit in stillness and offer this prayer.",
      secular: "Let us take a moment of reflection.",
    };

    const voice = isPrayer
      ? {
        voiceId: "Xb7hH8MSUJpSbSDYk0k2",
        stability: 0.8,
        style: 0.1,
        similarityBoost: 0.75,
        pickupLine: "",
      }
      : VOICE_MAP[key] || DEFAULT_VOICE;

    const prayerIntro = isPrayer ? PRAYER_INTROS[faith as string] || PRAYER_INTROS.secular : "";
    const spokenText = isPrayer
      ? `${prayerIntro} ... ${truncatedText}`
      : `${voice.pickupLine} ... ${truncatedText}`;

    const response = await fetchWithTimeoutAndRetry(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice.voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: spokenText,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: voice.stability,
            similarity_boost: voice.similarityBoost,
            style: voice.style,
            use_speaker_boost: true,
          },
        }),
      },
      ELEVENLABS_TIMEOUT_MS,
      ELEVENLABS_MAX_RETRIES,
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("TTS provider error:", response.status, errorBody);
      return new Response(
        JSON.stringify({
          error: "TTS generation failed",
          upstreamStatus: response.status,
          upstreamCode: providerErrorCode(errorBody),
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const audioBuffer = await response.arrayBuffer();

    return new Response(audioBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("TTS function error:", err);
    if (err instanceof Error && err.name === "AbortError") {
      return new Response(
        JSON.stringify({ error: "TTS provider timed out. Please try again." }),
        {
          status: 504,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred. Please try again." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
