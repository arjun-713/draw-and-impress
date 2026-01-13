import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";
import { motion } from "framer-motion";

interface TimerProps {
  endTime: string | null;
  onComplete?: () => void;
  size?: "sm" | "md" | "lg";
}

export const Timer = ({ endTime, onComplete, size = "md" }: TimerProps) => {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    if (!endTime) return;

    const calculateTimeLeft = () => {
      const end = new Date(endTime).getTime();
      const now = Date.now();
      const diff = Math.max(0, Math.floor((end - now) / 1000));
      return diff;
    };

    setTimeLeft(calculateTimeLeft());

    const interval = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        onComplete?.();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [endTime, onComplete]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isLow = timeLeft <= 10;
  const isCritical = timeLeft <= 5;

  const sizeClasses = {
    sm: "text-xl px-3 py-1",
    md: "text-3xl px-5 py-2",
    lg: "text-5xl px-8 py-4",
  };

  return (
    <motion.div
      className={cn(
        "inline-flex items-center gap-2 bg-card border-3 border-foreground rounded-xl shadow-sketch font-handwritten font-bold",
        sizeClasses[size],
        isLow && "text-warning",
        isCritical && "text-destructive"
      )}
      animate={isCritical ? { scale: [1, 1.05, 1] } : {}}
      transition={{ duration: 0.5, repeat: isCritical ? Infinity : 0 }}
    >
      <Clock className={cn(
        "opacity-70",
        size === "sm" && "w-4 h-4",
        size === "md" && "w-6 h-6",
        size === "lg" && "w-8 h-8",
      )} />
      <span>
        {minutes}:{seconds.toString().padStart(2, "0")}
      </span>
    </motion.div>
  );
};
