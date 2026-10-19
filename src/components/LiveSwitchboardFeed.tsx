import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

interface WeightedCity {
  name: string;
  weight: number;
}

const CITIES: WeightedCity[] = [
  { name: "Manila", weight: 5 },
  { name: "Lagos", weight: 5 },
  { name: "São Paulo", weight: 5 },
  { name: "Mumbai", weight: 5 },
  { name: "Jakarta", weight: 4 },
  { name: "Mexico City", weight: 4 },
  { name: "Cairo", weight: 4 },
  { name: "Seoul", weight: 3 },
  { name: "Tokyo", weight: 3 },
  { name: "Buenos Aires", weight: 3 },
  { name: "Bogotá", weight: 3 },
  { name: "Nairobi", weight: 3 },
  { name: "London", weight: 3 },
  { name: "Hanoi", weight: 3 },
  { name: "Cape Town", weight: 2 },
  { name: "Berlin", weight: 2 },
  { name: "Toronto", weight: 2 },
  { name: "the Midwest, USA", weight: 2 },
  { name: "Eastern India", weight: 3 },
  { name: "Northern Italy", weight: 2 },
  { name: "Southern France", weight: 2 },
  { name: "Central Mexico", weight: 3 },
  { name: "Western Australia", weight: 1 },
  { name: "Stockholm", weight: 1 },
  { name: "Auckland", weight: 1 },
];

const ACTIONS = [
  { text: "just called in", weight: 5 },
  { text: "submitted a prayer", weight: 4 },
  { text: "joined the prayer wall", weight: 3 },
  { text: "lit a candle", weight: 3 },
  { text: "added their voice", weight: 3 },
  { text: "is on hold", weight: 2 },
  { text: "received a blessing", weight: 2 },
  { text: "dialed the hotline", weight: 3 },
  { text: "shared a praise report", weight: 1 },
  { text: "requested a transfer", weight: 1 },
];

function buildCumulative<T extends { weight: number }>(
  items: T[],
): { items: T[]; total: number; cumulative: number[] } {
  let total = 0;
  const cumulative = items.map((item) => {
    total += item.weight;
    return total;
  });
  return { items, total, cumulative };
}

const cityPool = buildCumulative(CITIES);
const actionPool = buildCumulative(ACTIONS);

function weightedPick<T extends { weight: number }>(pool: {
  items: T[];
  total: number;
  cumulative: number[];
}): T {
  const r = Math.random() * pool.total;
  for (let i = 0; i < pool.cumulative.length; i++) {
    if (r < pool.cumulative[i]) return pool.items[i];
  }
  return pool.items[pool.items.length - 1];
}

interface FeedItem {
  id: number;
  city: string;
  action: string;
}

let nextId = 0;

function generateItem(lastCity: string, lastAction: string): FeedItem {
  let city: string;
  do {
    city = weightedPick(cityPool).name;
  } while (city === lastCity && CITIES.length > 1);

  let action: string;
  do {
    action = weightedPick(actionPool).text;
  } while (action === lastAction && ACTIONS.length > 1);

  return { id: nextId++, city, action };
}

const LiveSwitchboardFeed = () => {
  const lastCityRef = useRef("");
  const lastActionRef = useRef("");

  const [items, setItems] = useState<FeedItem[]>(() => {
    const initial: FeedItem[] = [];
    for (let i = 0; i < 3; i++) {
      const item = generateItem(lastCityRef.current, lastActionRef.current);
      lastCityRef.current = item.city;
      lastActionRef.current = item.action;
      initial.push(item);
    }
    return initial;
  });

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    const tick = () => {
      const newItem = generateItem(lastCityRef.current, lastActionRef.current);
      lastCityRef.current = newItem.city;
      lastActionRef.current = newItem.action;
      setItems((prev) => [newItem, ...prev].slice(0, 4));
      timeout = setTimeout(tick, 3000 + Math.random() * 5000);
    };

    timeout = setTimeout(tick, 3000 + Math.random() * 5000);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <motion.div
      className="w-full max-w-lg rounded-xl border border-border bg-card p-4 md:p-5"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
    >
      <div className="mb-3 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs">🌍</span>
          <span className="text-xs font-bold text-foreground uppercase tracking-wider font-special-elite">
            Switchboard Ambience
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Simulated for atmosphere. No real caller data.
        </p>
      </div>
      <div className="space-y-1.5 overflow-hidden">
        <AnimatePresence initial={false} mode="popLayout">
          {items.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="flex items-center gap-2 text-xs text-muted-foreground"
            >
              <span className="text-[10px]">📞</span>
              <span>
                <span className="text-foreground font-medium">{item.city}</span> {item.action}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default LiveSwitchboardFeed;
