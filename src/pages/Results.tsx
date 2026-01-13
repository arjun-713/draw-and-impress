import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Trophy, Home, RotateCcw } from "lucide-react";
import { SketchButton } from "@/components/game/SketchButton";
import { SketchCard, SketchCardContent } from "@/components/game/SketchCard";
import { PlayerAvatar } from "@/components/game/PlayerAvatar";
import { useRoom } from "@/hooks/useRoom";

const Results = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { players, leaveRoom } = useRoom();

  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const winner = sortedPlayers[0];

  const handleHome = async () => {
    await leaveRoom();
    navigate("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", duration: 0.6 }}
        className="w-full max-w-lg"
      >
        <SketchCard variant="accent">
          <SketchCardContent className="text-center">
            <motion.div
              animate={{ rotate: [0, -10, 10, -10, 0] }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <Trophy className="w-24 h-24 mx-auto text-warning mb-4" />
            </motion.div>

            <h1 className="text-4xl font-handwritten mb-2">Game Over!</h1>
            
            {winner && (
              <div className="my-8">
                <p className="text-muted-foreground mb-4">Winner</p>
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <PlayerAvatar
                    username={winner.username}
                    color={winner.avatar_color}
                    score={winner.score}
                    size="lg"
                    showStatus={false}
                  />
                </motion.div>
              </div>
            )}

            <div className="space-y-2 mb-8">
              {sortedPlayers.map((player, i) => (
                <motion.div
                  key={player.id}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.7 + i * 0.1 }}
                  className="flex items-center justify-between p-3 bg-card rounded-xl border-2 border-foreground"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 flex items-center justify-center bg-muted rounded-full font-bold">
                      {i + 1}
                    </span>
                    <span className="font-display font-medium">{player.username}</span>
                  </div>
                  <span className="font-handwritten text-xl">{player.score} pts</span>
                </motion.div>
              ))}
            </div>

            <div className="flex gap-3">
              <SketchButton variant="outline" size="lg" onClick={handleHome} className="flex-1">
                <Home className="w-5 h-5" />
                Home
              </SketchButton>
              <SketchButton variant="success" size="lg" onClick={() => navigate(`/lobby/${code}`)} className="flex-1">
                <RotateCcw className="w-5 h-5" />
                Play Again
              </SketchButton>
            </div>
          </SketchCardContent>
        </SketchCard>
      </motion.div>
    </div>
  );
};

export default Results;
