import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Canvas as FabricCanvas, PencilBrush } from "fabric";
import { motion } from "framer-motion";
import {
  Pencil,
  Eraser,
  Undo,
  Trash2,
  Trophy,
  AlertCircle,
  Loader2,
  Check,
  MessageSquare,
  Vote as VoteIcon
} from "lucide-react";
import { SketchButton } from "@/components/game/SketchButton";
import { SketchCard, SketchCardContent } from "@/components/game/SketchCard";
import { PlayerAvatar } from "@/components/game/PlayerAvatar";
import { Timer } from "@/components/game/Timer";
import { useRoom } from "@/hooks/useRoom";
import { cn } from "@/lib/utils";

const COLORS = ["#1a1a2e", "#FF6B6B", "#4ECDC4", "#FFE66D", "#95E1D3", "#F38181", "#AA96DA", "#FF9F43", "#6C5CE7"];

const Game = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const {
    room,
    players,
    drawings,
    votes: allVotes,
    playerId,
    submitDrawing,
    castVote,
    rejoinRoom,
    roomLoadingState,
    error,
    startGame, // For host "Play Again"
  } = useRoom();

  // Canvas State
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [activeColor, setActiveColor] = useState(COLORS[0]);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Computed State
  const currentPlayer = players.find(p => p.id === playerId);
  const hasSubmitted = drawings.some(d => d.player_id === playerId && d.round === room?.current_round);
  const myVote = allVotes.find(v => v.voter_id === playerId);
  const isHost = room?.host_id === playerId;

  // Rejoin room logic
  useEffect(() => {
    if (code && roomLoadingState === 'idle' && !room) {
      rejoinRoom(code);
    }
  }, [code, roomLoadingState, room, rejoinRoom]);

  // Redirect if game finished
  useEffect(() => {
    if (room?.status === "finished") {
      // Stay on results but show final
    }
  }, [room?.status]);

  // --- Canvas Logic ---
  useEffect(() => {
    if (!canvasRef.current || room?.status !== 'drawing' || hasSubmitted) return;
    if (fabricCanvas) return;

    const timer = setTimeout(() => {
      if (!canvasRef.current) return;
      try {
        const canvas = new FabricCanvas(canvasRef.current, {
          width: 580, // slightly smaller to fit card
          height: 420,
          backgroundColor: "#ffffff",
          isDrawingMode: true,
          selection: false,
        });

        const brush = new PencilBrush(canvas);
        brush.color = activeColor;
        brush.width = 4;
        canvas.freeDrawingBrush = brush;

        setFabricCanvas(canvas);
      } catch (err) {
        console.error("Canvas init error:", err);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [room?.status, hasSubmitted]);

  useEffect(() => {
    if (fabricCanvas && fabricCanvas.freeDrawingBrush) {
      fabricCanvas.freeDrawingBrush.color = tool === "eraser" ? "#ffffff" : activeColor;
      fabricCanvas.freeDrawingBrush.width = tool === "eraser" ? 20 : 4;
    }
  }, [tool, activeColor, fabricCanvas]);

  // Clean up canvas when phase changes or unmount
  useEffect(() => {
    if (room?.status !== 'drawing' && fabricCanvas) {
      fabricCanvas.dispose();
      setFabricCanvas(null);
    }
  }, [room?.status]);


  // --- Actions ---
  const handleClear = () => {
    if (fabricCanvas) {
      fabricCanvas.clear();
      fabricCanvas.backgroundColor = "#ffffff";
      fabricCanvas.renderAll();
    }
  };

  const handleUndo = () => {
    if (fabricCanvas) {
      const objects = fabricCanvas.getObjects();
      if (objects.length > 0) fabricCanvas.remove(objects[objects.length - 1]);
    }
  };

  const handleSubmit = async () => {
    if (!fabricCanvas || hasSubmitted) return;
    setIsSubmitting(true);
    try {
      // Export original quality
      const dataUrl = fabricCanvas.toDataURL({ format: "png", quality: 0.8, multiplier: 1 });
      await submitDrawing(dataUrl);
      fabricCanvas.isDrawingMode = false;
    } finally {
      setIsSubmitting(false);
    }
  };


  // --- Render Helpers ---

  // Loading / Error
  if (!room || roomLoadingState === 'loading') {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin w-12 h-12 text-primary" /></div>;
  }
  if (roomLoadingState === 'error') {
    return <div className="min-h-screen flex items-center justify-center flex-col gap-4"><AlertCircle className="w-12 h-12 text-destructive" /><p>{error}</p><SketchButton onClick={() => navigate('/')}>Home</SketchButton></div>;
  }

  // --- Rendering Game Phases ---

  return (
    <div className="min-h-screen p-2 md:p-4 bg-background overflow-x-hidden">
      <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* --- MAIN GAME AREA --- */}
        <div className="lg:col-span-3 space-y-6">

          {/* HEADER */}
          <div className="flex flex-col sm:flex-row items-center justify-between bg-card p-4 rounded-xl border-2 border-foreground shadow-sm gap-4">
            <div className="text-center sm:text-left">
              <h1 className="font-handwritten text-2xl text-primary">Round {room.current_round} / {room.total_rounds}</h1>
              <p className="text-sm text-muted-foreground uppercase tracking-wider font-bold">{room.status} Phase</p>
            </div>

            <div className="text-center bg-accent/50 px-6 py-2 rounded-lg border border-foreground/10">
              <span className="text-xs text-muted-foreground uppercase tracking-widest block mb-1">Prompt</span>
              <h2 className="text-xl md:text-3xl font-bold font-display text-foreground">
                {room.status === 'drawing' ? room.current_prompt : "Reveal!"}
              </h2>
            </div>

            <Timer endTime={room.phase_end_at || undefined} onComplete={() => { }} />
          </div>

          {/* CANVAS AREA (DRAWING) */}
          {room.status === "drawing" && (
            <SketchCard className="w-full relative">
              <SketchCardContent className="p-4">
                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-4 mb-4 justify-between bg-secondary/30 p-2 rounded-lg">
                  <div className="flex gap-1 flex-wrap">
                    {COLORS.map(c => (
                      <button key={c} onClick={() => { setActiveColor(c); setTool("pen"); }}
                        className={cn("w-8 h-8 rounded-full border-2 border-white shadow-sm hover:scale-110 transition", activeColor === c && tool === "pen" && "ring-2 ring-primary scale-110")}
                        style={{ backgroundColor: c }}
                        disabled={hasSubmitted} />
                    ))}
                    <button onClick={() => { setActiveColor("#ffffff"); setTool("eraser"); }} className={cn("w-8 h-8 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center hover:scale-110", tool === "eraser" && "ring-2 ring-primary")}>
                      <Eraser className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <SketchButton size="icon" variant="outline" onClick={handleUndo} disabled={hasSubmitted}><Undo className="w-4 h-4" /></SketchButton>
                    <SketchButton size="icon" variant="destructive" onClick={handleClear} disabled={hasSubmitted}><Trash2 className="w-4 h-4" /></SketchButton>
                  </div>
                </div>

                {/* Canvas Container */}
                <div ref={canvasContainerRef} className="relative mx-auto bg-white border-4 border-foreground rounded-xl shadow-inner overflow-hidden max-w-[600px] aspect-[4/3]">
                  <canvas ref={canvasRef} className="block cursor-crosshair touch-none w-full h-full" />

                  {hasSubmitted && (
                    <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center backdrop-blur-sm z-10 p-6 text-center">
                      <Check className="w-16 h-16 text-green-500 mb-4" />
                      <h3 className="text-3xl font-handwritten text-green-600 mb-2">Done!</h3>
                      <p className="text-muted-foreground">Waiting for other artists...</p>
                    </div>
                  )}
                </div>

                {!hasSubmitted && (
                  <div className="mt-4 flex justify-center">
                    <SketchButton variant="success" size="lg" className="w-full max-w-sm text-xl" onClick={handleSubmit} disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : "Submit Drawing"}
                    </SketchButton>
                  </div>
                )}
              </SketchCardContent>
            </SketchCard>
          )}

          {/* GALLERY PHASE (VIEW ONLY) */}
          {room.status === "gallery" && (
            <div className="text-center py-10">
              <h2 className="text-4xl font-handwritten mb-8 animate-bounce">Submissions are in!</h2>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {drawings.map((d, i) => (
                  <motion.div
                    key={d.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-card p-2 rounded-xl border border-foreground shadow-sm"
                  >
                    <div className="bg-white rounded-lg overflow-hidden aspect-[4/3] relative">
                      <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/20 font-bold text-4xl select-none">?</div>
                      <img src={d.image_data} alt="Drawing" className="w-full h-full object-contain relative z-10" />
                    </div>
                  </motion.div>
                ))}
              </div>
              <p className="mt-8 text-xl font-display text-muted-foreground">Get ready to vote!</p>
            </div>
          )}

          {/* VOTING PHASE */}
          {room.status === "voting" && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h2 className="text-3xl font-handwritten">Vote for the Best Drawing!</h2>
                <p className="text-muted-foreground">Click on your favorite to cast your vote.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {drawings.map((d) => ({ ...d, sort: Math.random() }))
                  .sort((a, b) => a.sort - b.sort)
                  .map((d) => {
                    const isMine = d.player_id === playerId;
                    const isSelected = myVote?.drawing_id === d.id;

                    return (
                      <motion.div
                        key={d.id}
                        whileHover={!isMine ? { scale: 1.02 } : {}}
                        className={cn(
                          "relative group cursor-pointer border-4 rounded-xl overflow-hidden transition-all bg-card shadow-md",
                          isMine ? "border-muted opacity-80 cursor-not-allowed" : "hover:shadow-xl",
                          isSelected ? "border-primary ring-4 ring-primary/30" : "border-foreground/10",
                          !isMine && !isSelected && "hover:border-primary/50"
                        )}
                        onClick={() => !isMine && castVote(d.id)}
                      >
                        <div className="aspect-[4/3] bg-white p-2">
                          <img src={d.image_data} alt="Drawing" className="w-full h-full object-contain" />
                        </div>

                        {/* Overlay for Mine */}
                        {isMine && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <span className="text-white font-bold px-3 py-1 bg-black/50 rounded-full">Your Drawing</span>
                          </div>
                        )}

                        {/* Selected Indicator */}
                        {isSelected && (
                          <div className="absolute top-2 right-2 bg-primary text-white rounded-full p-2 shadow-lg animate-in zoom-in">
                            <VoteIcon className="w-6 h-6" />
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* RESULTS PHASE */}
          {(room.status === "results" || room.status === "finished") && (
            <div className="space-y-8">
              <div className="text-center">
                <h2 className="text-4xl font-handwritten mb-2">{room.status === "finished" ? "Game Over!" : "Round Results"}</h2>
              </div>

              {/* Winner Spotlight */}
              {(() => {
                const sortedDrawings = [...drawings].sort((a, b) => {
                  const votesA = allVotes.filter(v => v.drawing_id === a.id).length;
                  const votesB = allVotes.filter(v => v.drawing_id === b.id).length;
                  return votesB - votesA;
                });
                const winner = sortedDrawings[0];
                const winnerVotes = allVotes.filter(v => v.drawing_id === winner?.id).length;
                const author = players.find(p => p.id === winner?.player_id);

                if (!winner) return null;

                return (
                  <div className="flex flex-col items-center justify-center p-8 bg-card border-4 border-yellow-400 rounded-3xl shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-200" />
                    <Trophy className="w-16 h-16 text-yellow-500 mb-4 animate-bounce" />

                    <div className="relative w-full max-w-md aspect-[4/3] bg-white rounded-xl border-2 border-foreground shadow-inner mb-6 rotate-1">
                      <img src={winner.image_data} className="w-full h-full object-contain" />
                      <div className="absolute -bottom-4 -right-4 bg-yellow-400 text-black font-bold px-4 py-2 rounded-full border-2 border-black transform rotate-[-5deg] shadow-sm">
                        {winnerVotes} Votes!
                      </div>
                    </div>

                    <h3 className="text-2xl font-display">Winner: <span className="text-primary">{author?.username}</span></h3>
                  </div>
                );
              })()}

              {/* Leaderboard Summary */}
              <div className="bg-muted/30 rounded-xl p-6">
                <h3 className="text-xl font-bold font-display mb-4">Current Standings</h3>
                <div className="space-y-2">
                  {players.sort((a, b) => b.score - a.score).map((p, i) => (
                    <div key={p.id} className="flex items-center justify-between bg-card p-3 rounded-lg border border-border shadow-sm">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-muted-foreground w-6">#{i + 1}</span>
                        <PlayerAvatar username={p.username} color={p.avatar_color} size="sm" />
                        <span className="font-bold">{p.username}</span>
                      </div>
                      <span className="font-mono font-bold text-lg">{p.score} pts</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Host Controls */}
              {isHost && room.status === "finished" && (
                <div className="flex justify-center pt-6">
                  <SketchButton variant="default" size="xl" onClick={() => startGame()}>
                    Play Again
                  </SketchButton>
                </div>
              )}
            </div>
          )}

        </div>

        {/* --- SIDEBAR (Leaderboard/Chat) --- */}
        <div className="lg:col-span-1 hidden lg:flex flex-col gap-6 h-[calc(100vh-2rem)] sticky top-4">
          {/* Simple Leaderboard Sidebar */}
          <div className="bg-card border-2 border-foreground rounded-xl p-4 shadow-sm">
            <h3 className="font-display font-bold text-lg mb-3 flex items-center gap-2"><Trophy className="w-4 h-4 text-yellow-500" /> Leaderboard</h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {players.sort((a, b) => b.score - a.score).map((p, i) => (
                <div key={p.id} className={cn("flex items-center gap-2 p-2 rounded-lg", p.id === playerId ? "bg-primary/10 border border-primary/20" : "bg-muted/50")}>
                  <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                  <div className="w-2 h-2 rounded-full" style={{ background: p.avatar_color }} />
                  <span className="text-sm font-medium truncate flex-1">{p.username}</span>
                  <span className="text-xs font-mono">{p.score}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Chat Placeholder */}
          {/* Since prompt said 'No chat during drawing or voting', maybe we just show system messages or simple emote log? For now leaving plain or removing chat complexity as requested */}
          <div className="bg-card border-2 border-foreground rounded-xl flex-1 p-4 shadow-sm flex flex-col items-center justify-center text-center text-muted-foreground opacity-50">
            <MessageSquare className="w-8 h-8 mb-2" />
            <p className="text-sm">Chat disabled during gameplay</p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Game;
