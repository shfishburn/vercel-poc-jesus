import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DepartmentSelector from "@/components/DepartmentSelector";
import ErrorScreen, { getErrorInfo } from "@/components/ErrorScreen";
import FaithSelector from "@/components/FaithSelector";
import HoldScreen from "@/components/HoldScreen";
import PrayerCategories, { type PrayerCategory } from "@/components/PrayerCategories";
import ResponseScreen from "@/components/ResponseScreen";
import Seo from "@/components/Seo.tsx";
import TypingIndicator from "@/components/TypingIndicator";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import VerseOfTheDay from "@/components/VerseOfTheDay";
import { useToast } from "@/hooks/use-toast";
import { useRateLimit } from "@/hooks/useRateLimit";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics.ts";
import { FAITHS, getFaith } from "@/lib/faiths";
import { functionErrorMessage } from "@/lib/functionError";
import { useFavoritesStore } from "@/stores/useFavoritesStore";
import { usePrayerHistoryStore } from "@/stores/usePrayerHistoryStore";
import { usePreferencesStore } from "@/stores/usePreferencesStore";

type Phase = "step1" | "step2" | "step3" | "holding" | "typing" | "response" | "error";

const MAX_CHARS = 500;

const stepVariants = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
  exit: { opacity: 0, x: -40, transition: { duration: 0.25, ease: "easeIn" as const } },
};

const PrayerPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    faithId,
    department,
    category,
    researchConsent,
    shareToWall,
    setFaith,
    setDepartment,
    setCategory,
  } = usePreferencesStore();
  const { addRecord, rateRecord } = usePrayerHistoryStore();
  const { toggleFavorite, isFavorite } = useFavoritesStore();

  // Only restore state from sessionStorage when returning via browser back/forward
  // (popstate). Fresh navigations (clicking links/buttons) start clean.
  const isPopState =
    typeof window !== "undefined" &&
    window.performance?.getEntriesByType("navigation")?.[0] &&
    (window.performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming).type ===
      "back_forward";
  const stored = isPopState ? sessionStorage.getItem("prayerPageState") : null;
  const initial = stored ? JSON.parse(stored) : null;

  const [phase, setPhase] = useState<Phase>(
    initial?.phase && initial.phase !== "holding" && initial.phase !== "typing"
      ? initial.phase
      : "step1",
  );
  const [prayer, setPrayer] = useState(initial?.prayer || "");
  const [aiResponse, setAiResponse] = useState(initial?.aiResponse || "");
  const [closingPrayer, setClosingPrayer] = useState<string | null>(initial?.closingPrayer || null);
  const [responseMode, setResponseMode] = useState<string>(initial?.responseMode || "normal");
  const [loading, setLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const { checkLimit, secondsRemaining, isLimited } = useRateLimit();
  const [currentRecordId, setCurrentRecordId] = useState<string | null>(
    initial?.currentRecordId || null,
  );
  const { toast } = useToast();
  const [holdDone, setHoldDone] = useState(false);

  // Persist key state to sessionStorage
  useEffect(() => {
    sessionStorage.setItem(
      "prayerPageState",
      JSON.stringify({
        phase,
        prayer,
        aiResponse,
        closingPrayer,
        currentRecordId,
        responseMode,
      }),
    );
  }, [phase, prayer, aiResponse, closingPrayer, currentRecordId, responseMode]);

  const faith = getFaith(faithId);

  const handleFaithChange = (newFaith: typeof faithId) => {
    setFaith(newFaith);
  };

  const callPrayer = async (msg: string, dept: string, cat: PrayerCategory) => {
    if (!checkLimit()) {
      setLastError("You've been calling too frequently. Please wait a moment.");
      setPhase("error");
      return;
    }
    // Clear the previous call so a transfer or retry never shows a stale reply,
    // and never skips the hold because the last hold already completed.
    setAiResponse("");
    setClosingPrayer(null);
    setResponseMode("normal");
    setHoldDone(false);
    setPhase("holding");
    setLoading(true);
    setLastError(null);

    try {
      const { data, error } = await supabase.functions.invoke("pray", {
        body: {
          message: msg,
          faith: faithId,
          department: dept,
          category: cat,
          consent: researchConsent,
          shareToWall,
        },
      });

      if (error) throw new Error(await functionErrorMessage(error));

      const reply = data?.reply || "The line went silent. Please try again.";
      setAiResponse(reply);
      setClosingPrayer(data?.closingPrayer || null);
      setResponseMode(data?.mode || "normal");
      const record = addRecord(msg, reply, faithId, dept, cat || undefined);
      setCurrentRecordId(record.id);
      trackEvent("prayer_response_received", {
        faith_id: faithId,
        department: dept,
        category: cat,
        response_mode: data?.mode || "normal",
        has_closing_prayer: Boolean(data?.closingPrayer),
      });
    } catch (err: unknown) {
      console.error("Prayer error:", err);
      const info = getErrorInfo(err instanceof Error ? err : null);
      // Keep the server's own text; the category only picks the screen title.
      setLastError(err instanceof Error && err.message ? err.message : info.message);
      setPhase("error");
      trackEvent("prayer_response_error", {
        faith_id: faithId,
        department: dept,
        category: cat,
        error_title: info.title,
      });
    } finally {
      setLoading(false);
    }
  };

  const submitPrayer = async () => {
    if (!prayer.trim()) {
      toast({
        title: "Empty message",
        description: "Please enter something before calling in.",
        variant: "destructive",
      });
      return;
    }
    trackEvent("prayer_submitted", {
      faith_id: faithId,
      department,
      category,
      prayer_length: prayer.trim().length,
      share_to_wall: shareToWall,
      research_consent: researchConsent,
    });
    await callPrayer(prayer.trim(), department, category);
  };

  const handleTransfer = (newDept: string) => {
    trackEvent("prayer_transferred", {
      faith_id: faithId,
      from_department: department,
      to_department: newDept,
      category,
    });
    setDepartment(newDept);
    callPrayer(prayer.trim() || "Please help me", newDept, category);
  };

  const onHoldComplete = useCallback(() => {
    setHoldDone(true);
  }, []);

  // Transition from hold → typing when both hold completes and AI responds
  useEffect(() => {
    if (holdDone && aiResponse && phase === "holding") {
      setPhase("typing");
      setHoldDone(false);
    }
  }, [holdDone, aiResponse, phase]);

  // Transition from typing → response after a short delay
  useEffect(() => {
    if (phase === "typing") {
      const timer = setTimeout(() => setPhase("response"), 3000);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  // Restore a history record when navigated from HistoryPage
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    const recordId = (location.state as { recordId?: string } | null)?.recordId;
    if (!recordId) return;
    const record = usePrayerHistoryStore.getState().history.find((r) => r.id === recordId);
    if (record) {
      restoredRef.current = true;
      setPrayer(record.prayer);
      setAiResponse(record.response);
      setCurrentRecordId(record.id);
      if (record.faithId) setFaith(record.faithId as typeof faithId);
      if (record.department) setDepartment(record.department);
      if (record.category) setCategory(record.category as PrayerCategory);
      setPhase("response");
      window.history.replaceState({}, "");
    }
  }, [location.state, setCategory, setDepartment, setFaith]);

  const reset = () => {
    sessionStorage.removeItem("prayerPageState");
    navigate("/");
  };

  const handleRate = (rating: "up" | "down") => {
    if (currentRecordId) {
      rateRecord(currentRecordId, rating);
      trackEvent("response_rated", {
        faith_id: faithId,
        department,
        category,
        rating,
      });
    }
  };

  const handleToggleFavorite = () => {
    if (!currentRecordId) return;
    const nextFavorited = !isFavorite(currentRecordId);
    toggleFavorite(currentRecordId);
    trackEvent("response_favorite_toggled", {
      faith_id: faithId,
      department,
      category,
      favorited: nextFavorited,
    });
  };

  const isStep = phase === "step1" || phase === "step2" || phase === "step3";
  const stepNumber = phase === "step1" ? 1 : phase === "step2" ? 2 : phase === "step3" ? 3 : 0;

  return (
    <>
      <Seo
        title={`${faith.hotlineName} — Call In | ${faith.phoneNumber}`}
        description="Submit a prayer to the hotline and receive a satirical AI response with safety guardrails and crisis redirects when needed."
        path="/pray"
      />
      <AnimatePresence mode="wait">
        {phase === "error" && (
          <motion.div
            key="error"
            variants={stepVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <ErrorScreen
              title={getErrorInfo(lastError).title}
              message={lastError || undefined}
              onRetry={() => {
                setLastError(null);
                setPhase("step3");
              }}
              onGoHome={reset}
            />
          </motion.div>
        )}

        {phase === "holding" && (
          <motion.div
            key="hold"
            variants={stepVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <HoldScreen onComplete={onHoldComplete} faith={faith} />
          </motion.div>
        )}

        {phase === "typing" && (
          <motion.div
            key="typing"
            variants={stepVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <TypingIndicator />
          </motion.div>
        )}

        {phase === "response" && (
          <motion.div
            key="response"
            variants={stepVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <ResponseScreen
              prayer={prayer}
              response={aiResponse}
              currentDepartment={department}
              faith={faith}
              mode={responseMode}
              onHangUp={reset}
              closingPrayer={closingPrayer}
              onCallAgain={() => {
                setAiResponse("");
                setPrayer("");
                setClosingPrayer(null);
                setResponseMode("normal");
                setHoldDone(false);
                setCurrentRecordId(null);
                setPhase("step3");
              }}
              onRate={handleRate}
              onTransfer={handleTransfer}
              onToggleFavorite={currentRecordId ? handleToggleFavorite : undefined}
              isFavorited={currentRecordId ? isFavorite(currentRecordId) : false}
            />
          </motion.div>
        )}

        {isStep && (
          <motion.div
            key="wizard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center min-h-screen gap-6 px-6 py-12"
          >
            {/* Header */}
            <motion.div
              className="text-center space-y-1"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              <motion.div
                className="text-5xl md:text-7xl inline-block"
                animate={{ scale: [1, 1.06, 1], rotate: [0, -3, 3, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1, ease: "easeInOut" }}
              >
                {faith.emoji}
              </motion.div>
              <h1 className="text-3xl md:text-5xl font-bold text-primary tracking-tight font-special-elite">
                {faith.hotlineName}
              </h1>
              <p className="text-lg text-muted-foreground font-bold font-special-elite">
                {faith.phoneNumber}
              </p>
              <p className="text-sm text-muted-foreground italic">{faith.tagline}</p>
            </motion.div>

            {/* Step indicator */}
            <nav className="flex items-center gap-2" aria-label="Prayer steps">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (s < stepNumber) setPhase(`step${s}` as Phase);
                    }}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      s === stepNumber
                        ? "bg-primary text-primary-foreground shadow-md scale-110"
                        : s < stepNumber
                          ? "bg-primary/30 text-primary cursor-pointer hover:bg-primary/50"
                          : "bg-muted text-muted-foreground"
                    }`}
                    aria-label={`Step ${s}${s === stepNumber ? " (current)" : ""}`}
                    aria-current={s === stepNumber ? "step" : undefined}
                  >
                    {s}
                  </button>
                  {s < 3 && (
                    <div className={`w-8 h-0.5 ${s < stepNumber ? "bg-primary/30" : "bg-muted"}`} />
                  )}
                </div>
              ))}
            </nav>

            {/* Step content */}
            <AnimatePresence mode="wait">
              {phase === "step1" && (
                <motion.div
                  key="s1"
                  variants={stepVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="flex flex-col items-center gap-6 w-full"
                >
                  <FaithSelector value={faithId} onChange={handleFaithChange} />
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={() => navigate("/")}
                        className="py-6 gap-2"
                      >
                        ← Home
                      </Button>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={() => {
                          const randomFaith = FAITHS[Math.floor(Math.random() * FAITHS.length)];
                          const depts = randomFaith.departments;
                          const randomDept = depts[Math.floor(Math.random() * depts.length)];
                          const categories = [
                            "gratitude",
                            "guidance",
                            "complaint",
                            "emergency",
                          ] as const;
                          const randomCat =
                            categories[Math.floor(Math.random() * categories.length)];
                          setFaith(randomFaith.id);
                          setDepartment(randomDept.id);
                          setCategory(randomCat);
                          setPhase("step3");
                        }}
                        className="py-6 gap-2 border-dashed border-primary/40 text-primary hover:bg-primary/5"
                      >
                        🎲 Surprise Me
                      </Button>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button
                        size="lg"
                        onClick={() => setPhase("step2")}
                        className="text-lg px-10 py-6 gap-3 rounded-full shadow-lg"
                      >
                        Next →
                      </Button>
                    </motion.div>
                  </div>
                </motion.div>
              )}

              {phase === "step2" && (
                <motion.div
                  key="s2"
                  variants={stepVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="flex flex-col items-center gap-6 w-full"
                >
                  <VerseOfTheDay faith={faith} />
                  <DepartmentSelector value={department} onChange={setDepartment} faith={faith} />
                  <div className="w-full max-w-lg space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Category (optional)
                    </p>
                    <PrayerCategories value={category} onChange={setCategory} />
                  </div>
                  <div className="flex items-center gap-4">
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={() => setPhase("step1")}
                        className="py-6 gap-2"
                      >
                        ← Back
                      </Button>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button
                        size="lg"
                        onClick={() => setPhase("step3")}
                        className="text-lg px-10 py-6 gap-3 rounded-full shadow-lg"
                      >
                        Next →
                      </Button>
                    </motion.div>
                  </div>
                </motion.div>
              )}

              {phase === "step3" && (
                <motion.div
                  key="s3"
                  variants={stepVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="flex flex-col items-center gap-6 w-full"
                >
                  {/* Summary chips */}
                  <div className="flex flex-wrap gap-2 justify-center">
                    <button
                      type="button"
                      onClick={() => setPhase("step1")}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border text-xs font-medium hover:border-primary/50 transition-colors"
                    >
                      {faith.emoji} {faith.name} <span className="text-muted-foreground">✎</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPhase("step2")}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border text-xs font-medium hover:border-primary/50 transition-colors"
                    >
                      {faith.departments.find((d) => d.id === department)?.emoji}{" "}
                      {faith.departments.find((d) => d.id === department)?.label}
                      <span className="text-muted-foreground">✎</span>
                    </button>
                    {category && (
                      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/30 text-xs font-medium text-accent">
                        {category}
                      </span>
                    )}
                  </div>

                  <motion.div
                    className="w-full max-w-lg space-y-3"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                  >
                    <label
                      className="text-sm font-semibold text-foreground uppercase tracking-wider"
                      htmlFor="prayer"
                    >
                      {faith.inputLabel}
                    </label>
                    <Textarea
                      id="prayer"
                      placeholder={faith.placeholder}
                      value={prayer}
                      onChange={(e) => {
                        if (e.target.value.length <= MAX_CHARS) setPrayer(e.target.value);
                      }}
                      className="min-h-[160px] text-base bg-card"
                      maxLength={MAX_CHARS}
                      autoFocus={window.matchMedia("(pointer: fine)").matches}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        {prayer.length}/{MAX_CHARS} characters
                      </span>
                      <span>All calls are anonymous</span>
                    </div>
                  </motion.div>

                  {/* Share to Prayer Wall toggle */}
                  <div className="flex items-start gap-3 w-full max-w-lg px-4 py-3 rounded-lg border border-border bg-card hover:border-primary/30 transition-colors">
                    <Checkbox
                      checked={shareToWall}
                      onCheckedChange={(checked) =>
                        usePreferencesStore.getState().setShareToWall(checked === true)
                      }
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        Share anonymously to the Prayer Wall 🕯️
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                        Your prayer will appear on the community wall. No name or identity is
                        attached.
                      </p>
                    </div>
                  </div>

                  {/* Research consent checkbox */}
                  <div className="flex items-start gap-3 w-full max-w-lg px-4 py-3 rounded-lg border border-border bg-card hover:border-primary/30 transition-colors">
                    <Checkbox
                      checked={researchConsent}
                      onCheckedChange={(checked) =>
                        usePreferencesStore.getState().setResearchConsent(checked === true)
                      }
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        Contribute to AI safety research 🔬
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                        Logs anonymized metadata only (interaction mode, safety signals). Your
                        prayer text is never stored.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={() => setPhase("step2")}
                        className="py-6 gap-2"
                      >
                        ← Back
                      </Button>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button
                        size="lg"
                        onClick={submitPrayer}
                        disabled={loading || !prayer.trim() || isLimited}
                        className="text-lg px-10 py-6 gap-3 rounded-full shadow-lg"
                      >
                        {isLimited ? `⏳ Wait ${secondsRemaining}s` : "📞 Call In"}
                      </Button>
                    </motion.div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default PrayerPage;
