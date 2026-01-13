import { cn } from "@/lib/utils";
import { Crown, Check, Wifi, WifiOff } from "lucide-react";

interface PlayerAvatarProps {
  username: string;
  color: string;
  isHost?: boolean;
  isReady?: boolean;
  isConnected?: boolean;
  score?: number;
  size?: "sm" | "md" | "lg";
  showStatus?: boolean;
}

export const PlayerAvatar = ({
  username,
  color,
  isHost = false,
  isReady = false,
  isConnected = true,
  score,
  size = "md",
  showStatus = true,
}: PlayerAvatarProps) => {
  const sizeClasses = {
    sm: "w-10 h-10 text-sm",
    md: "w-14 h-14 text-lg",
    lg: "w-20 h-20 text-2xl",
  };

  const initial = username.charAt(0).toUpperCase();

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        {/* Crown for host */}
        {isHost && (
          <Crown 
            className="absolute -top-4 left-1/2 -translate-x-1/2 text-accent fill-accent" 
            size={size === "lg" ? 24 : 18} 
          />
        )}
        
        {/* Avatar circle */}
        <div
          className={cn(
            "rounded-full border-3 border-foreground shadow-sketch flex items-center justify-center font-handwritten font-bold transition-transform",
            sizeClasses[size],
            !isConnected && "opacity-50"
          )}
          style={{ backgroundColor: color }}
        >
          {initial}
        </div>
        
        {/* Status indicator */}
        {showStatus && (
          <div className="absolute -bottom-1 -right-1">
            {isReady ? (
              <div className="w-6 h-6 bg-success rounded-full border-2 border-foreground flex items-center justify-center">
                <Check size={14} className="text-success-foreground" />
              </div>
            ) : !isConnected ? (
              <div className="w-6 h-6 bg-muted rounded-full border-2 border-foreground flex items-center justify-center">
                <WifiOff size={12} className="text-muted-foreground" />
              </div>
            ) : null}
          </div>
        )}
      </div>
      
      {/* Username */}
      <span className={cn(
        "font-display font-medium truncate max-w-[80px]",
        size === "sm" && "text-xs",
        size === "md" && "text-sm",
        size === "lg" && "text-base",
      )}>
        {username}
      </span>
      
      {/* Score */}
      {score !== undefined && (
        <span className="text-xs font-display text-muted-foreground">
          {score} pts
        </span>
      )}
    </div>
  );
};
