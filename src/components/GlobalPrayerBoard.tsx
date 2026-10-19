import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  isSupabaseConfigured,
  missingSupabaseEnvMessage,
  supabase,
} from "@/integrations/supabase/client";
import { functionErrorMessage } from "@/lib/functionError";
import { getSessionId } from "@/lib/sessionId";

const SESSION_ID = getSessionId();

interface BoardIssue {
  id: string;
  emoji: string;
  issue: string;
  department: string;
  status: string;
  voices: number;
  voices_today: number;
}

const ROTATING_STATUSES = [
  "Open",
  "Open",
  "Open",
  "Open",
  "Under Review",
  "Escalated",
  "Pending Mysterious Ways",
  "Archangel Approval Requested",
  "Awaiting Miracles Department",
];

const CONFIRMATIONS = [
  "Your voice has been added to the request.\n\nThe Heavenly Switchboard assures us that large-scale matters occasionally require a great many tickets.",
  "Your voice has been forwarded to the Angels on Duty queue.\n\nMany voices together still matter.",
  "Ticket updated.\n\nYour concern has been escalated to the Department of Mysterious Ways.",
  "Voice received.\n\nPlease note: miracles may take additional processing time.",
  "Your request has been logged.\n\nThe celestial filing system is working on it.",
];

function pickStatus() {
  return ROTATING_STATUSES[Math.floor(Math.random() * ROTATING_STATUSES.length)];
}

const GlobalPrayerBoard = () => {
  const { toast } = useToast();
  const [issues, setIssues] = useState<BoardIssue[]>([]);
  const [displayStatuses, setDisplayStatuses] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [votedSet, setVotedSet] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (issues.length === 0) return;
    const initial: Record<string, string> = {};
    issues.forEach((i) => {
      initial[i.id] = pickStatus();
    });
    setDisplayStatuses(initial);
    const interval = setInterval(() => {
      setDisplayStatuses((prev) => {
        const next = { ...prev };
        const randomIssue = issues[Math.floor(Math.random() * issues.length)];
        if (randomIssue) {
          let newStatus: string;
          do {
            newStatus = pickStatus();
          } while (newStatus === prev[randomIssue.id] && ROTATING_STATUSES.length > 1);
          next[randomIssue.id] = newStatus;
        }
        return next;
      });
    }, 15000);
    return () => clearInterval(interval);
  }, [issues]);

  const fetchIssues = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError(
        "Global Prayer Board is unavailable until Supabase environment variables are configured.",
      );
      setLoading(false);
      return;
    }

    const { data, error: issuesError } = await supabase
      .from("global_prayer_board")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true });

    if (issuesError) {
      setError("Unable to load the Global Prayer Board right now. Please try again later.");
      setLoading(false);
      return;
    }

    if (data) {
      setIssues(data as BoardIssue[]);
      setError(null);
    }

    setLoading(false);
  }, []);

  const fetchMyVotes = useCallback(async () => {
    if (!isSupabaseConfigured) return;

    const { data, error: votesError } = await supabase.functions.invoke<{ issueIds: string[] }>(
      "community",
      { body: { action: "my_votes", sessionId: SESSION_ID } },
    );
    if (votesError) {
      toast({
        title: "Error",
        description: await functionErrorMessage(votesError),
        variant: "destructive",
      });
      return;
    }
    setVotedSet(new Set(data?.issueIds ?? []));
  }, [toast]);

  useEffect(() => {
    fetchIssues();
    fetchMyVotes();
  }, [fetchIssues, fetchMyVotes]);

  const handleVote = async (issueId: string) => {
    if (!isSupabaseConfigured) {
      toast({
        title: "Service unavailable",
        description: missingSupabaseEnvMessage,
        variant: "destructive",
      });
      return;
    }

    if (votedSet.has(issueId)) return;
    setVotedSet((prev) => new Set(prev).add(issueId));
    setIssues((prev) =>
      prev.map((i) =>
        i.id === issueId ? { ...i, voices: i.voices + 1, voices_today: i.voices_today + 1 } : i,
      ),
    );
    setConfirming(issueId);
    setTimeout(() => setConfirming(null), 4000);
    const { data, error } = await supabase.functions.invoke<{ ok: boolean; added: boolean }>(
      "community",
      { body: { action: "vote", issueId, sessionId: SESSION_ID } },
    );
    if (error) {
      toast({
        title: "Error",
        description: await functionErrorMessage(error),
        variant: "destructive",
      });
      setVotedSet((prev) => {
        const next = new Set(prev);
        next.delete(issueId);
        return next;
      });
      fetchIssues();
      return;
    }
    if (data?.added === false) {
      fetchIssues();
    }
  };

  const formatCount = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : n.toString();

  if (loading)
    return (
      <div className="w-full max-w-lg text-center py-8 text-sm text-muted-foreground animate-pulse">
        Loading prayer board…
      </div>
    );

  if (error) {
    return <div className="w-full max-w-lg text-center py-8 text-sm text-destructive">{error}</div>;
  }

  return (
    <motion.div
      className="w-full max-w-lg space-y-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-foreground uppercase tracking-wider font-special-elite">
          📠 Global Prayer Board
        </h2>
        <p className="text-xs text-muted-foreground">
          Open tickets from the Heavenly Support Center. Add your voice.
        </p>
      </div>

      <div className="space-y-3">
        {issues.map((issue) => {
          const voted = votedSet.has(issue.id);
          const showConfirm = confirming === issue.id;
          return (
            <motion.div
              key={issue.id}
              className="bg-card border border-border rounded-lg p-4 space-y-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="space-y-0.5">
                <p className="text-sm font-bold text-foreground">
                  <span className="mr-1.5">{issue.emoji}</span>
                  {issue.issue}
                </p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                  Dept: {issue.department} • Status:{" "}
                  <span className="text-primary">{displayStatuses[issue.id] || issue.status}</span>
                </p>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground font-mono">
                    🗣 {formatCount(issue.voices)} voices
                  </span>
                  {issue.voices_today > 0 && (
                    <span className="text-[10px] text-muted-foreground/60">
                      +{issue.voices_today} voice{issue.voices_today !== 1 ? "s" : ""} today
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleVote(issue.id)}
                  disabled={voted}
                  className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${voted ? "bg-primary/10 border-primary/30 text-primary cursor-default" : "bg-transparent border-border text-muted-foreground hover:border-primary/50 hover:text-foreground hover:bg-primary/5"}`}
                  aria-label={
                    voted
                      ? `Your voice added to: ${issue.issue}`
                      : `Add your voice to: ${issue.issue}`
                  }
                >
                  {voted ? "✓ Voice Added" : "🙏 Add Your Voice"}
                </button>
              </div>
              <AnimatePresence>
                {showConfirm && (
                  <motion.div
                    className="bg-primary/5 border border-primary/20 rounded-md p-3"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <p className="text-xs text-foreground/80 whitespace-pre-line leading-relaxed font-special-elite">
                      📞 {CONFIRMATIONS[Math.floor(Math.random() * CONFIRMATIONS.length)]}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground/50 text-center italic">
        Many voices together still matter.
      </p>
    </motion.div>
  );
};

export default GlobalPrayerBoard;
