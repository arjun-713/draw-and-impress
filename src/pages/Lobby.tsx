import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Copy, Play, LogOut, Settings, Loader2, AlertCircle, Users } from "lucide-react";
import { SketchButton } from "@/components/game/SketchButton";
import { SketchCard, SketchCardContent, SketchCardHeader, SketchCardTitle } from "@/components/game/SketchCard";
import { PlayerAvatar } from "@/components/game/PlayerAvatar";
import { Input } from "@/components/ui/input";
import { useRoom } from "@/hooks/useRoom";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const Lobby = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { 
    room, 
    players, 
    playerId, 
    userId,
    leaveRoom, 
    toggleReady, 
    updateSettings, 
    startGame,
    joinRoom,
    rejoinRoom,
    roomLoadingState,
    error,
    loading
  } = useRoom();

  const [username, setUsername] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  const currentPlayer = players.find(p => p.id === playerId);
  const isHost = currentPlayer?.is_host;
  const allReady = players.length > 1 && players.every(p => p.is_host || p.is_ready);
  const isInRoom = players.some(p => p.user_id === userId);

  // Try to rejoin room on mount
  useEffect(() => {
    if (code && roomLoadingState === 'idle' && !playerId) {
      rejoinRoom(code);
    }
  }, [code, roomLoadingState, playerId, rejoinRoom]);

  // Navigate to game when it starts
  useEffect(() => {
    if (room?.status === "drawing") {
      navigate(`/game/${code}`);
    }
  }, [room?.status, code, navigate]);

  const copyCode = () => {
    navigator.clipboard.writeText(code || "");
    toast({ title: "Copied!", description: "Room code copied to clipboard" });
  };

  const handleLeave = async () => {
    await leaveRoom();
    navigate("/");
  };

  const handleStart = async () => {
    if (!allReady && players.length > 1) {
      toast({ variant: "destructive", title: "Not everyone is ready!" });
      return;
    }
    await startGame();
  };

  const handleJoin = async () => {
    if (!username.trim() || !code) {
      toast({ variant: "destructive", title: "Enter your name!" });
      return;
    }
    
    setIsJoining(true);
    try {
      await joinRoom(code, username.trim());
    } catch (err) {
      console.error('Join error:', err);
    } finally {
      setIsJoining(false);
    }
  };

  // Loading state
  if (roomLoadingState === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="text-xl font-display">Loading lobby...</p>
      </div>
    );
  }

  // Error state
  if (roomLoadingState === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <p className="text-xl font-display text-destructive">{error || 'Failed to load room'}</p>
        <SketchButton onClick={() => navigate('/')}>
          Go Home
        </SketchButton>
      </div>
    );
  }

  // Room exists but user not in it - show join form
  if (room && !isInRoom && roomLoadingState !== 'joined') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-md"
        >
          <SketchCard>
            <SketchCardHeader>
              <SketchCardTitle className="flex items-center gap-2 justify-center">
                <Users className="w-6 h-6" />
                Join Room {code}
              </SketchCardTitle>
            </SketchCardHeader>
            <SketchCardContent className="space-y-4">
              <div>
                <label className="block text-sm font-display mb-2">Your Name</label>
                <Input
                  placeholder="Enter your name..."
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-12 text-lg border-2 border-foreground rounded-xl"
                  maxLength={20}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                />
              </div>
              
              <SketchButton
                variant="success"
                size="lg"
                onClick={handleJoin}
                disabled={isJoining || loading || !username.trim()}
                className="w-full"
              >
                {isJoining ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Joining...
                  </>
                ) : (
                  'Join Game'
                )}
              </SketchButton>
              
              <SketchButton
                variant="ghost"
                onClick={() => navigate('/')}
                className="w-full"
              >
                Back to Home
              </SketchButton>
              
              <p className="text-sm text-muted-foreground text-center">
                {players.length}/{room.max_players} players in lobby
              </p>
            </SketchCardContent>
          </SketchCard>
        </motion.div>
      </div>
    );
  }

  // Still loading room data
  if (!room) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="text-xl font-display">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-background">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <SketchButton variant="outline" size="sm" onClick={handleLeave}>
            <LogOut className="w-4 h-4" />
            Leave
          </SketchButton>
          
          <motion.div 
            className="flex items-center gap-3 cursor-pointer"
            onClick={copyCode}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <span className="text-sm text-muted-foreground">Room Code:</span>
            <div className="flex items-center gap-2 bg-accent px-4 py-2 rounded-xl border-2 border-foreground">
              <span className="text-2xl font-mono font-bold tracking-widest">{code}</span>
              <Copy className="w-5 h-5" />
            </div>
          </motion.div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Players */}
          <div className="md:col-span-2">
            <SketchCard>
              <SketchCardHeader>
                <SketchCardTitle>Players ({players.length}/{room.max_players})</SketchCardTitle>
              </SketchCardHeader>
              <SketchCardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {players.map((player, i) => (
                    <motion.div
                      key={player.id}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: i * 0.1 }}
                    >
                      <PlayerAvatar
                        username={player.username}
                        color={player.avatar_color}
                        isHost={player.is_host}
                        isReady={player.is_ready}
                        isConnected={player.is_connected}
                        size="lg"
                      />
                    </motion.div>
                  ))}
                </div>
                
                {!isHost && currentPlayer && (
                  <div className="mt-6 flex justify-center">
                    <SketchButton
                      variant={currentPlayer?.is_ready ? "success" : "secondary"}
                      size="lg"
                      onClick={toggleReady}
                    >
                      {currentPlayer?.is_ready ? "Ready! ✓" : "Ready Up"}
                    </SketchButton>
                  </div>
                )}
              </SketchCardContent>
            </SketchCard>
          </div>

          {/* Settings */}
          <div>
            <SketchCard variant="secondary">
              <SketchCardHeader>
                <SketchCardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Settings
                </SketchCardTitle>
              </SketchCardHeader>
              <SketchCardContent className="space-y-4">
                <div>
                  <label className="text-sm font-display mb-1 block">Rounds</label>
                  <Select
                    value={room.total_rounds.toString()}
                    onValueChange={(v) => isHost && updateSettings({ total_rounds: parseInt(v) })}
                    disabled={!isHost}
                  >
                    <SelectTrigger className="border-2 border-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2, 3, 4, 5, 6].map(n => (
                        <SelectItem key={n} value={n.toString()}>{n} rounds</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-sm font-display mb-1 block">Draw Time</label>
                  <Select
                    value={room.draw_time.toString()}
                    onValueChange={(v) => isHost && updateSettings({ draw_time: parseInt(v) })}
                    disabled={!isHost}
                  >
                    <SelectTrigger className="border-2 border-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[30, 45, 60, 90, 120].map(n => (
                        <SelectItem key={n} value={n.toString()}>{n}s</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {isHost && (
                  <SketchButton
                    variant="success"
                    size="lg"
                    onClick={handleStart}
                    disabled={players.length < 2}
                    className="w-full mt-4"
                  >
                    <Play className="w-5 h-5" />
                    Start Game
                  </SketchButton>
                )}
                
                {players.length < 2 && (
                  <p className="text-sm text-muted-foreground text-center">
                    Need at least 2 players
                  </p>
                )}
              </SketchCardContent>
            </SketchCard>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Lobby;
