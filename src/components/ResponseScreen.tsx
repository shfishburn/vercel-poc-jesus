import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import ClosingPrayerPlayer from "@/components/ClosingPrayerPlayer";
import PrayerVoicePlayer from "@/components/PrayerVoicePlayer";
import PrayWithCallerButton from "@/components/PrayWithCallerButton";
import ShareableCard from "@/components/ShareableCard";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useDingSound } from "@/hooks/useDingSound";
import { trackEvent } from "@/lib/analytics.ts";
import { describeClosingPrayerError } from "@/lib/closingPrayer";
import type { FaithConfig } from "@/lib/faiths";
import { formatBold } from "@/lib/formatBold";

interface ResponseScreenProps {
  prayer: string;
  response: string;
  closingPrayer?: string | null;
  closingPrayerError?: string | null;
  currentDepartment: string;
  faith: FaithConfig;
  mode?: string;
  onHangUp: () => void;
  onCallAgain: () => void;
  onRate?: (rating: "up" | "down") => void;
  onTransfer?: (dept: string) => void;
  onToggleFavorite?: () => void;
  isFavorited?: boolean;
}

const CRISIS_KEYWORDS = [
  "988",
  "suicide",
  "crisis lifeline",
  "self-harm",
  "kill myself",
  "end my life",
  "want to die",
  "hopeless",
  "no reason to live",
];

const ResponseScreen = ({
  prayer,
  response,
  closingPrayer,
  closingPrayerError,
  currentDepartment,
  faith,
  mode = "normal",
  onHangUp,
  onCallAgain,
  onRate,
  onTransfer,
  onToggleFavorite,
  isFavorited,
}: ResponseScreenProps) => {
  const isDeflection = mode === "troll" || mode === "off_topic";
  const [rating, setRating] = useState<"up" | "down" | null>(null);
  const { toast } = useToast();
  const playDing = useDingSound();

  useEffect(() => {
    playDing();
  }, [playDing]);

  const hasCrisisInfo = CRISIS_KEYWORDS.some((kw) => response.toLowerCase().includes(kw));

  const ticketId = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < prayer.length; i++) {
      hash = ((hash << 5) - hash + prayer.charCodeAt(i)) | 0;
    }
    return `${faith.id.slice(0, 3).toUpperCase()}-${Math.abs(hash).toString(36).toUpperCase().padStart(5, "0")}`;
  }, [prayer, faith.id]);

  const handleShare = async () => {
    const text = `🙏 My ${faith.hotlineName} response:\n\n${response}\n\n— ${faith.hotlineName} (${faith.phoneNumber})`;
    try {
      if (navigator.share) {
        await navigator.share({ title: faith.hotlineName, text });
        trackEvent("response_shared", {
          faith_id: faith.id,
          department: currentDepartment,
          method: "native_share",
        });
        return;
      }
    } catch {
      // navigator.share exists but failed (e.g. sandbox iframe) — fall through to clipboard
    }
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied!", description: "Response copied to clipboard." });
      trackEvent("response_shared", {
        faith_id: faith.id,
        department: currentDepartment,
        method: "clipboard",
      });
    } catch {
      toast({
        title: "Couldn't share",
        description: "Please copy the text manually.",
        variant: "destructive",
      });
      trackEvent("response_share_failed", {
        faith_id: faith.id,
        department: currentDepartment,
      });
    }
  };

  const handleCopyTranscript = async () => {
    const text = `📞 ${faith.hotlineName} Call Transcript\n\n🙏 My prayer:\n${prayer}\n\n💬 Agent response:\n${response}\n\n— ${faith.hotlineName} (${faith.phoneNumber})`;
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "📋 Transcript Copied!",
        description: "Prayer and response copied to clipboard.",
      });
      trackEvent("transcript_copied", {
        faith_id: faith.id,
        department: currentDepartment,
      });
    } catch {
      // fallback
    }
  };

  const handleRate = (r: "up" | "down") => {
    setRating(r);
    onRate?.(r);
    toast({
      title: r === "up" ? "🙌 Blessed!" : "😔 Noted",
      description: r === "up" ? "Glad this landed." : "We'll relay your feedback.",
    });
  };

  const handleHangUp = () => {
    trackEvent("response_action_clicked", {
      faith_id: faith.id,
      department: currentDepartment,
      action: "hang_up",
    });
    onHangUp();
  };

  const handleCallAgain = () => {
    trackEvent("response_action_clicked", {
      faith_id: faith.id,
      department: currentDepartment,
      action: "call_again",
    });
    onCallAgain();
  };

  return (
    <section
      aria-label="Prayer response"
      className="flex flex-col items-center justify-center min-h-screen gap-8 px-6 py-12"
    >
      <motion.div
        className="text-5xl"
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
      >
        {faith.responseIcon}
      </motion.div>

      <motion.h2
        className="text-2xl md:text-3xl font-bold text-primary font-special-elite"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        Call Transcript
      </motion.h2>

      {/* Support Ticket Envelope */}
      <motion.div
        className="w-full max-w-lg bg-card border border-border rounded-lg p-5 shadow-md space-y-3"
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.25, duration: 0.5 }}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground uppercase tracking-widest">
            📨 Support Ticket
          </span>
          <span className="text-xs font-mono font-bold text-primary">{ticketId}</span>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="px-2 py-0.5 rounded-full bg-muted">
            {faith.emoji} {faith.name}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-muted">
            {faith.departments.find((d) => d.id === currentDepartment)?.emoji}{" "}
            {faith.departments.find((d) => d.id === currentDepartment)?.label}
          </span>
        </div>
        <div className="border-t border-border pt-3">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">
            Your Prayer
          </p>
          <p className="text-sm text-foreground leading-relaxed">{prayer}</p>
        </div>
      </motion.div>

      {/* Agent Response */}
      <motion.div
        className="w-full max-w-lg bg-card border border-border rounded-lg p-6 shadow-md"
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        <div className="text-xs text-muted-foreground mb-3 uppercase tracking-widest">
          {faith.responseLabel}
        </div>
        <p className="text-foreground leading-relaxed whitespace-pre-wrap">
          {formatBold(response)}
        </p>
      </motion.div>

      {/* Voice Player + Pray With Caller — hide for deflections */}
      {!isDeflection && (
        <>
          <PrayerVoicePlayer
            response={response}
            department={currentDepartment}
            faith={faith.id}
            hasCrisisInfo={hasCrisisInfo}
          />
          <PrayWithCallerButton ticketId={ticketId} />
        </>
      )}

      {/* Closing Prayer Ticket — hide for deflections */}
      {!isDeflection && closingPrayer && (
        <motion.div
          className="w-full max-w-lg bg-card border border-border rounded-lg p-5 shadow-md space-y-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase tracking-widest">
              🙏 Closing Prayer
            </span>
            <span className="text-xs font-mono font-bold text-primary">{ticketId}-P</span>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="px-2 py-0.5 rounded-full bg-muted">
              {faith.emoji} {faith.name}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-muted">
              {faith.departments.find((d) => d.id === currentDepartment)?.emoji}{" "}
              {faith.departments.find((d) => d.id === currentDepartment)?.label}
            </span>
          </div>
          <div className="border-t border-border pt-3">
            <p className="text-foreground leading-relaxed whitespace-pre-wrap italic">
              {formatBold(closingPrayer)}
            </p>
          </div>
        </motion.div>
      )}

      {!isDeflection && !closingPrayer && closingPrayerError && (
        <motion.div
          className="w-full max-w-lg bg-card border border-dashed border-border rounded-lg p-5 shadow-sm space-y-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          role="status"
        >
          <span className="text-xs text-muted-foreground uppercase tracking-widest">
            🙏 Closing Prayer
          </span>
          <p className="text-sm text-muted-foreground">
            {describeClosingPrayerError(closingPrayerError)} Press Try Again to request another.
          </p>
        </motion.div>
      )}

      {!isDeflection && closingPrayer && (
        <ClosingPrayerPlayer
          closingPrayer={closingPrayer}
          department={currentDepartment}
          faith={faith.id}
        />
      )}

      {/* Rate — hide for deflections */}
      {!isDeflection && (
        <motion.div
          className="flex items-center gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45 }}
        >
          <span className="text-xs text-muted-foreground uppercase tracking-wider">
            Rate this wisdom:
          </span>
          <motion.button
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => handleRate("up")}
            className={`text-2xl transition-opacity ${rating === "down" ? "opacity-30" : ""}`}
            disabled={rating !== null}
          >
            👍
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => handleRate("down")}
            className={`text-2xl transition-opacity ${rating === "up" ? "opacity-30" : ""}`}
            disabled={rating !== null}
          >
            👎
          </motion.button>
        </motion.div>
      )}

      {hasCrisisInfo && (
        <motion.div
          className="w-full max-w-lg bg-accent/10 border border-accent rounded-lg p-4 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <p className="text-sm font-semibold text-accent">
            🆘 If you or someone you know is in crisis, call or text{" "}
            <a
              href="tel:988"
              className="underline font-bold"
              onClick={() =>
                trackEvent("crisis_hotline_clicked", {
                  source: "response_screen",
                  faith_id: faith.id,
                })
              }
            >
              988
            </a>{" "}
            (Suicide & Crisis Lifeline) anytime.
          </p>
        </motion.div>
      )}

      <motion.div
        className="w-full max-w-lg space-y-5"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
      >
        {/* Transfer — hide for deflections */}
        {!isDeflection && onTransfer && faith.departments.length > 1 && (
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              🔀 Transfer
            </span>
            <div className="flex gap-2 flex-wrap">
              {faith.departments
                .filter((d) => d.id !== currentDepartment)
                .map((dept) => (
                  <motion.div key={dept.id} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onTransfer(dept.id)}
                      className="gap-1.5 text-xs"
                    >
                      {dept.emoji} {dept.label}
                    </Button>
                  </motion.div>
                ))}
            </div>
          </div>
        )}

        {/* Share & Save — hide for deflections */}
        {!isDeflection && (
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              📎 Share & Save
            </span>
            <div className="flex gap-2 flex-wrap">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyTranscript}
                  className="gap-2"
                >
                  📋 Copy Transcript
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button variant="outline" size="sm" onClick={handleShare} className="gap-2">
                  📤 Share
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <ShareableCard
                  response={response}
                  faith={faith}
                  ticketId={ticketId}
                  currentDepartment={currentDepartment}
                />
              </motion.div>
              {onToggleFavorite && (
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button variant="outline" size="sm" onClick={onToggleFavorite} className="gap-2">
                    {isFavorited ? "⭐" : "☆"} {isFavorited ? "Saved" : "Save"}
                  </Button>
                </motion.div>
              )}
            </div>
          </div>
        )}

        {/* Call Actions — always visible, simplified */}
        <div className="space-y-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
            📞 Call Actions
          </span>
          <div className="flex gap-2 flex-wrap">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button variant="outline" size="sm" onClick={handleHangUp} className="gap-2">
                📵 Hang Up
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button size="sm" onClick={handleCallAgain} className="gap-2">
                📞 Try Again
              </Button>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </section>
  );
};

export default ResponseScreen;
