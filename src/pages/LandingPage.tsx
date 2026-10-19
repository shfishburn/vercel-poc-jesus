import { motion } from "framer-motion";
import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import heroImage from "@/assets/hero-hotline.jpg";
import HowItWorks from "@/components/HowItWorks";
import LiveSwitchboardFeed from "@/components/LiveSwitchboardFeed";
import PrayerVolumeIndicator from "@/components/PrayerVolumeIndicator";
import Seo from "@/components/Seo.tsx";
import SufferingTicker from "@/components/SufferingTicker";
import { Button } from "@/components/ui/button";
import VerseOfTheDay from "@/components/VerseOfTheDay";
import { trackEvent } from "@/lib/analytics.ts";
import { getFaith } from "@/lib/faiths";
import { usePreferencesStore } from "@/stores/usePreferencesStore";

// Preload the PrayerPage chunk so /pray navigations are instant
const preloadPrayerPage = () => import("./PrayerPage");

const LandingPage = () => {
  const navigate = useNavigate();
  const { faithId } = usePreferencesStore();
  useEffect(() => {
    preloadPrayerPage();
  }, []);

  const faith = getFaith(faithId);

  return (
    <>
      <Seo
        title={`${faith.hotlineName} — AI Prayer Experience`}
        description={`${faith.tagline} Submit your prayer, hold for divine customer service, and receive heavenly guidance.`}
        path="/"
      />

      <div className="flex flex-col">
        {/* Hero */}
        <motion.section
          className="relative flex flex-col items-center justify-center px-6 pt-12 pb-10 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          <motion.div
            className="w-36 h-36 md:w-48 md:h-48 rounded-2xl overflow-hidden shadow-xl border-2 border-primary/20 mb-6"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
          >
            <img
              src={heroImage}
              alt="Divine Hotline — retro telephone with golden rays"
              width="192"
              height="192"
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </motion.div>

          <motion.div
            className="text-4xl md:text-6xl inline-block"
            animate={{ scale: [1, 1.06, 1], rotate: [0, -3, 3, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1, ease: "easeInOut" }}
          >
            {faith.emoji}
          </motion.div>

          <h1 className="text-3xl md:text-5xl font-bold text-primary tracking-tight mt-3 font-special-elite">
            {faith.hotlineName}
          </h1>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest mt-1">
            AI-Powered • Not a Real Hotline
          </p>
          <p className="text-sm text-muted-foreground italic mt-1 max-w-md text-center">
            {faith.tagline}
          </p>
          <p className="text-xs text-muted-foreground/70 mt-3 max-w-sm text-center leading-relaxed">
            A satirical AI prayer experience exploring how chatbots should — and shouldn't — handle
            spiritual questions.
          </p>

          <motion.div className="mt-6" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              size="lg"
              onClick={() => {
                trackEvent("cta_clicked", { cta: "submit_prayer_hero" });
                navigate("/pray");
              }}
              className="text-xl px-12 py-7 gap-3 rounded-full shadow-xl"
            >
              📞 Submit a Prayer
            </Button>
          </motion.div>
        </motion.section>

        {/* How It Works */}
        <section className="flex justify-center px-6 py-6">
          <HowItWorks />
        </section>

        {/* Switchboard Status (simulated) */}
        <section className="flex justify-center px-6 py-4">
          <PrayerVolumeIndicator />
        </section>

        {/* Live Global Feed */}
        <section className="flex justify-center px-6 py-4">
          <LiveSwitchboardFeed />
        </section>

        {/* Community CTA */}
        <section className="flex justify-center px-6 py-6">
          <div className="w-full max-w-lg bg-card border border-border rounded-xl p-6 text-center space-y-3">
            <h2 className="text-lg font-bold text-foreground uppercase tracking-wider font-special-elite">
              🕯️ Community Prayer Wall & Board
            </h2>
            <p className="text-sm text-muted-foreground">
              Light candles, share prayers, and add your voice to global causes.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                trackEvent("cta_clicked", { cta: "community_wall" });
                navigate("/community");
              }}
              className="gap-2"
            >
              Visit the Community →
            </Button>
          </div>
        </section>

        {/* Verse of the Day */}
        <section className="flex justify-center px-6 py-6">
          <VerseOfTheDay faith={faith} />
        </section>

        {/* Satire Disclaimer — always last before footer */}
        <section className="flex justify-center px-6 py-12">
          <div className="max-w-lg w-full bg-card border border-border rounded-xl p-6 md:p-8 text-center space-y-4">
            <h2 className="text-lg md:text-xl font-bold text-foreground font-special-elite">
              This Is Satire. Real Pain Is Not.
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The joke isn't faith — it's the idea that a chatbot could replace it. The hotline bit
              is satire. Your feelings never are.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              If you or someone you know is struggling, real help exists — free, confidential, and
              available right now.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Link
                to="/crisis"
                onClick={() => trackEvent("cta_clicked", { cta: "crisis_resources" })}
                className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline transition-colors"
              >
                📞 Crisis Resources & Ways to Give →
              </Link>
              <span className="text-muted-foreground/40 hidden sm:inline">·</span>
              <Link
                to="/observatory"
                onClick={() => trackEvent("cta_clicked", { cta: "global_pain_index" })}
                className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:underline transition-colors"
              >
                🌍 Global Pain Index →
              </Link>
            </div>
          </div>
        </section>

        {/* Suffering Index Ticker — subtle footer-adjacent element */}
        <section className="flex justify-center px-6 pb-8">
          <SufferingTicker />
        </section>
      </div>
    </>
  );
};

export default LandingPage;
