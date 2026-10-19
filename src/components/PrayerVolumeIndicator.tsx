import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

function randomBetween(min: number, max: number) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

const VOLUME_PHRASES = [
  "Steady Stream",
  "Quite Busy",
  "High",
  "Very High",
  "Heavenly",
  "Off the Charts",
  "Divine Levels",
  "Holy Moly",
] as const;

const EASTER_EGG_TEMPLATES = [
  { label: "Miracle Queue", values: ["Pending", "Processing", "Overflowing"] },
  { label: "Saints Available", gen: () => `${randomBetween(2, 5)}` },
  { label: "Dept. of Mysterious Ways", values: ["Backlogged", "Swamped", "On It"] },
  { label: "Archangel Escalations", gen: () => `${randomBetween(1, 4)}` },
  { label: "Burning Bush Callback", values: ["Scheduled", "Imminent", "Any moment"] },
  { label: "Moses Status", values: ["On the other line", "Parting something", "In a meeting"] },
];

function generateEasterEgg() {
  const t = EASTER_EGG_TEMPLATES[randomBetween(0, EASTER_EGG_TEMPLATES.length - 1)];
  const value = t.gen ? t.gen() : t.values?.[randomBetween(0, t.values?.length - 1)];
  return { label: t.label, value };
}

/** Map active calls & cherubs to a volume phrase index */
function deriveVolumeIndex(activeCalls: number, cherubs: number): number {
  const ratio = activeCalls / Math.max(cherubs, 1);
  if (ratio < 8) return 0; // Steady Stream
  if (ratio < 12) return 1; // Quite Busy
  if (ratio < 16) return 2; // High
  if (ratio < 22) return 3; // Very High
  if (ratio < 30) return 4; // Heavenly
  if (ratio < 40) return 5; // Off the Charts
  if (ratio < 55) return 6; // Divine Levels
  return 7; // Holy Moly
}

/** Correlate wait time to load */
function deriveWaitTime(activeCalls: number, cherubs: number): number {
  const base = 2 + (activeCalls / Math.max(cherubs, 1)) * 0.4;
  return clamp(Math.round(base + randomBetween(-1, 1)), 2, 18);
}

const PrayerVolumeIndicator = () => {
  const [cherubsOnline, setCherubsOnline] = useState(() => randomBetween(5, 8));
  const [activeCalls, setActiveCalls] = useState(() => randomBetween(60, 120));
  const [easterEgg, setEasterEgg] = useState<{ label: string; value: string } | null>(null);

  const cherubsRef = useRef(cherubsOnline);
  const callsRef = useRef(activeCalls);

  // Keep refs in sync
  useEffect(() => {
    cherubsRef.current = cherubsOnline;
  }, [cherubsOnline]);
  useEffect(() => {
    callsRef.current = activeCalls;
  }, [activeCalls]);

  // Active calls: drift ±1–3 every 4–6s
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const tick = () => {
      setActiveCalls((prev) => clamp(prev + randomBetween(-3, 3), 30, 250));
      timeout = setTimeout(tick, randomBetween(4000, 6000));
    };
    timeout = setTimeout(tick, randomBetween(4000, 6000));
    return () => clearTimeout(timeout);
  }, []);

  // Cherubs online: drift ±1 every 20–30s
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const tick = () => {
      setCherubsOnline((prev) => clamp(prev + randomBetween(-1, 1), 3, 11));
      timeout = setTimeout(tick, randomBetween(20000, 30000));
    };
    timeout = setTimeout(tick, randomBetween(20000, 30000));
    return () => clearTimeout(timeout);
  }, []);

  // Easter egg: 12% chance every 12–18s, recomputed each time
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (Math.random() < 0.12) {
        setEasterEgg(generateEasterEgg());
      } else {
        setEasterEgg(null);
      }
      timeout = setTimeout(tick, randomBetween(12000, 18000));
    };
    timeout = setTimeout(tick, randomBetween(12000, 18000));
    return () => clearTimeout(timeout);
  }, []);

  // Derived metrics
  const volumeIndex = deriveVolumeIndex(activeCalls, cherubsOnline);
  const volume = VOLUME_PHRASES[volumeIndex];
  const waitTime = deriveWaitTime(activeCalls, cherubsOnline);

  return (
    <motion.div
      className="w-full max-w-lg rounded-xl border border-border bg-card p-4 md:p-5"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <div className="mb-3 space-y-1">
        <div className="flex items-center gap-2">
          <motion.div
            className="w-2 h-2 rounded-full bg-green-500"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <span className="text-xs font-bold text-foreground uppercase tracking-wider font-special-elite">
            Switchboard Status (simulated)
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Simulated for atmosphere. No real caller data.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 text-center">
        <Stat label="Prayer Volume" value={volume} highlight />
        <Stat label="Cherubs Online" value={`${cherubsOnline}`} />
        {easterEgg ? (
          <Stat label={easterEgg.label} value={easterEgg.value} highlight />
        ) : (
          <Stat label="Avg. Wait" value={`${waitTime}s`} />
        )}
        <Stat label="Active Calls" value={`${activeCalls}`} />
      </div>
    </motion.div>
  );
};

const Stat = ({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) => (
  <div className="space-y-0.5">
    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
      {label}
    </p>
    <p className={`text-sm font-bold font-mono ${highlight ? "text-primary" : "text-foreground"}`}>
      {value}
    </p>
  </div>
);

export default PrayerVolumeIndicator;
