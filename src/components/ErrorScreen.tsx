import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

interface ErrorScreenProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  onGoHome?: () => void;
}

const ERROR_MESSAGES: Record<string, { icon: string; title: string; message: string }> = {
  network: {
    icon: "📡",
    title: "Signal Lost",
    message:
      "Looks like the divine phone lines are down. Check your internet connection and try again.",
  },
  timeout: {
    icon: "⏳",
    title: "Hold Time Exceeded",
    message: "Even angels have their limits. The call timed out — please try again.",
  },
  rateLimit: {
    icon: "🚦",
    title: "Slow Down, Pilgrim",
    message: "You've been calling too frequently. Please wait a moment before trying again.",
  },
  server: {
    icon: "🔧",
    title: "Heavenly Maintenance",
    message: "The celestial servers are experiencing issues. Our angel IT team is on it.",
  },
  default: {
    icon: "😇",
    title: "Something Went Wrong",
    message: "An unexpected error occurred. The hotline staff is looking into it.",
  },
};

export function getErrorInfo(error?: string | Error | null) {
  const msg = typeof error === "string" ? error : error?.message || "";
  const lower = msg.toLowerCase();

  if (
    lower.includes("fetch") ||
    lower.includes("network") ||
    lower.includes("offline") ||
    lower.includes("failed to send")
  )
    return ERROR_MESSAGES.network;
  if (lower.includes("timeout") || lower.includes("timed out")) return ERROR_MESSAGES.timeout;
  if (
    lower.includes("429") ||
    lower.includes("rate") ||
    lower.includes("jammed") ||
    lower.includes("busy")
  )
    return ERROR_MESSAGES.rateLimit;
  if (
    lower.includes("500") ||
    lower.includes("server") ||
    lower.includes("gateway") ||
    lower.includes("relay") ||
    lower.includes("unavailable") ||
    lower.includes("budget")
  )
    return ERROR_MESSAGES.server;
  return ERROR_MESSAGES.default;
}

const ErrorScreen = ({ title, message, onRetry, onGoHome }: ErrorScreenProps) => {
  const info = ERROR_MESSAGES.default;
  const displayTitle = title || info.title;
  const displayMessage = message || info.message;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-6 py-12 text-center">
      <motion.div
        className="text-6xl"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
      >
        😇
      </motion.div>

      <motion.h2
        className="text-2xl md:text-3xl font-bold text-primary font-special-elite"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {displayTitle}
      </motion.h2>

      <motion.p
        className="text-muted-foreground max-w-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        {displayMessage}
      </motion.p>

      <motion.div
        className="flex gap-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        {onRetry && (
          <Button onClick={onRetry} className="gap-2">
            🔄 Try Again
          </Button>
        )}
        {onGoHome && (
          <Button variant="outline" onClick={onGoHome} className="gap-2">
            🏠 Go Home
          </Button>
        )}
      </motion.div>
    </div>
  );
};

export default ErrorScreen;
