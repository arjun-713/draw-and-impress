import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Canvas as FabricCanvas, PencilBrush } from "fabric";
import { motion } from "framer-motion";
import { Pencil, Eraser, Undo, Trash2, Trophy, AlertCircle, Loader2, Star, MessageSquare } from "lucide-react";
import { SketchButton } from "@/components/game/SketchButton";
import { SketchCard, SketchCardContent } from "@/components/game/SketchCard";
import { PlayerAvatar } from "@/components/game/PlayerAvatar";
import { Timer } from "@/components/game/Timer";
import { Chat } from "@/components/game/Chat";
import { useRoom, type Vote } from "@/hooks/useRoom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const COLORS = ["#1a1a2e", "#FF6B6B", "#4ECDC4", "#FFE66D", "#95E1D3", "#F38181", "#AA96DA", "#FF9F43", "#6C5CE7"];

const Game = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const {
    room,
    players,
    drawings,
    playerId,
    submitDrawing,
    castVote,
    rejoinRoom,
    roomLoadingState,
    error,
    checkHasSubmitted,
    votes: allVotes // From realtime stats
  } = useRoom();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [activeColor, setActiveColor] = useState(COLORS[0]);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [myVotes, setMyVotes] = useState<Record<string, number>>({});
  const [canvasInitialized, setCanvasInitialized] = useState(false);

  const currentPlayer = players.find(p => p.id === playerId);

  // Rejoin room logic
  useEffect(() => {
    if (code && roomLoadingState === 'idle') {
      rejoinRoom(code);
    }
  }, [code, roomLoadingState, rejoinRoom]);

  // Check submission status
  useEffect(() => {
    const checkSubmission = async () => {
      if (room?.status === 'drawing' && playerId) {
        const submitted = await checkHasSubmitted();
        setHasSubmitted(submitted);
      }
    };
    checkSubmission();
  }, [room?.status, room?.current_round, playerId, checkHasSubmitted]);

  // Initialize Canvas (Fabric.js v6)
  useEffect(() => {
    if (!canvasRef.current || room?.status !== 'drawing' || hasSubmitted) return;
    if (fabricCanvas) return;

    // Wait for DOM
    const timer = setTimeout(() => {
      if (!canvasRef.current) return;

      try {
        console.log("Initializing canvas...");
        const canvas = new FabricCanvas(canvasRef.current, {
          width: 600,
          height: 450,
          backgroundColor: "#ffffff",
          isDrawingMode: true,
          selection: false,
        });

        // Setup Brush
        const brush = new PencilBrush(canvas);
        brush.color = activeColor;
        brush.width = 4;
        canvas.freeDrawingBrush = brush;

        setFabricCanvas(canvas);
        setCanvasInitialized(true);
      } catch (err) {
        console.error("Canvas init error:", err);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [room?.status, hasSubmitted, activeColor]);

  // Update Brush
  useEffect(() => {
    if (!fabricCanvas || !fabricCanvas.freeDrawingBrush) return;
    fabricCanvas.freeDrawingBrush.color = tool === "eraser" ? "#ffffff" : activeColor;
    fabricCanvas.freeDrawingBrush.width = tool === "eraser" ? 20 : 4;
  }, [tool, activeColor, fabricCanvas]);

  // Cleanup Canvas
  useEffect(() => {
    return () => {
      if (fabricCanvas) {
        fabricCanvas.dispose();
      }
    };
  }, [fabricCanvas]);

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
      if (objects.length > 0) {
        fabricCanvas.remove(objects[objects.length - 1]);
      }
    }
  };

  const handleSubmit = async () => {
    if (!fabricCanvas || hasSubmitted) return;
    setIsSubmitting(true);
    try {
      const dataUrl = fabricCanvas.toDataURL({ format: "png", quality: 0.8, multiplier: 1 });
      const success = await submitDrawing(dataUrl);
      if (success) {
        setHasSubmitted(true);
        fabricCanvas.isDrawingMode = false;
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRate = async (drawingId: string, rating: number) => {
    if (myVotes[drawingId]) return; // prevent double vote if we track it locally
    const success = await castVote(drawingId, rating);
    if (success) {
      setMyVotes(prev => ({ ...prev, [drawingId]: rating }));
    }
  };

  const getAverageRating = (drawingId: string) => {
    if (!allVotes) return 0;
    const drawingVotes = (allVotes as Vote[]).filter((v) => v.drawing_id === drawingId);
    if (drawingVotes.length === 0) return 0;
    const sum = drawingVotes.reduce((acc, v) => acc + (v.rating || 0), 0);
    return sum / drawingVotes.length;
  };

  // Phase transition check
  const checkPhaseTransition = useCallback(async () => {
    if (!room?.id) return;
    try {
      await supabase.functions.invoke('game-manager', {
        body: { action: 'transition_room', roomId: room.id }
      });
    } catch (err) {
      console.error(err);
    }
  }, [room?.id]);

  useEffect(() => {
    if (!room?.id || room.status === 'lobby' || room.status === 'finished') return;
    const interval = setInterval(() => {
      if (room.phase_end_at && Date.now() > new Date(room.phase_end_at).getTime() + 2000) {
        checkPhaseTransition();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [room?.id, room?.phase_end_at, checkPhaseTransition, room?.status]);

  // Phase Auto-actions
  const handleTimeComplete = async () => {
    if (room?.status === "drawing" && !hasSubmitted) {
      if (fabricCanvas) await handleSubmit();
    }
    await checkPhaseTransition();
  };

  // Results Navigation
  useEffect(() => {
    if (room?.status === "finished") navigate(`/results/${code}`);
  }, [room?.status, code, navigate]);

  if (!room || roomLoadingState === 'loading') {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin w-12 h-12 text-primary" /></div>;
  }
  if (roomLoadingState === 'error') {
    return <div className="min-h-screen flex items-center justify-center flex-col gap-4"><AlertCircle className="w-12 h-12 text-destructive" /><p>{error}</p><SketchButton onClick={() => navigate('/')}>Home</SketchButton></div>;
  }

  return (
    <div className="min-h-screen p-4 bg-background">
      <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* LEFT COLUMN: GAME AREA (3 cols) */}
        <div className="lg:col-span-3 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between bg-card p-4 rounded-xl border-2 border-border shadow-sm">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="font-handwritten text-2xl text-primary">Round {room.current_round}</h1>
                <p className="text-sm text-muted-foreground capitalize">{room.status} Phase</p>
              </div>
            </div>
            <div className="text-center">
              <span className="text-xs text-muted-foreground uppercase tracking-widest">Theme</span>
              <h2 className="text-2xl font-bold font-display">{room.current_prompt || "???"}</h2>
            </div>
            <Timer endTime={room.phase_end_at} onComplete={handleTimeComplete} />
          </div>

          {/* Canvas Area */}
          {room.status === "drawing" && (
            <SketchCard className="w-full">
              <SketchCardContent>
                <div className="flex flex-wrap items-center gap-2 mb-4 justify-between">
                  <div className="flex gap-1">
                    {COLORS.map(c => (
                      <button key={c} onClick={() => { setActiveColor(c); setTool("pen"); }}
                        className={cn("w-8 h-8 rounded-full border-2 border-foreground transition-transform", activeColor === c && tool === "pen" && "scale-110 ring-2 ring-primary")}
                        style={{ backgroundColor: c }} disabled={hasSubmitted} />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <SketchButton size="icon" variant={tool === "pen" ? "default" : "outline"} onClick={() => setTool("pen")} disabled={hasSubmitted}><Pencil /></SketchButton>
                    <SketchButton size="icon" variant={tool === "eraser" ? "default" : "outline"} onClick={() => setTool("eraser")} disabled={hasSubmitted}><Eraser /></SketchButton>
                    <SketchButton size="icon" variant="outline" onClick={handleUndo} disabled={hasSubmitted}><Undo /></SketchButton>
                    <SketchButton size="icon" variant="destructive" onClick={handleClear} disabled={hasSubmitted}><Trash2 /></SketchButton>
                  </div>
                </div>

                <div
                  ref={canvasContainerRef}
                  className="relative mx-auto bg-white border-4 border-foreground rounded-xl shadow-inner overflow-hidden"
                  style={{ width: 600, height: 450 }}
                >
                  <canvas ref={canvasRef} width={600} height={450} className="block cursor-crosshair touch-none" />
                  {hasSubmitted && (
                    <div className="absolute inset-0 bg-background/60 flex items-center justify-center pointer-events-none backdrop-blur-sm">
                      <div className="bg-card p-6 rounded-xl border-2 border-success shadow-lg text-center transform rotate-[-5deg]">
                        <p className="text-2xl font-handwritten text-success">Submitted!</p>
                        <p className="text-muted-foreground">Waiting for others...</p>
                      </div>
                    </div>
                  )}
                </div>

                {!hasSubmitted && (
                  <SketchButton variant="success" size="lg" className="w-full mt-4" onClick={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="animate-spin" /> : "Submit Masterpiece"}
                  </SketchButton>
                )}
              </SketchCardContent>
            </SketchCard>
          )}

          {/* Voting / Gallery Area */}
          {(room.status === "gallery" || room.status === "voting") && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {drawings.map((drawing) => {
                const isMine = drawing.player_id === playerId;
                const myVote = myVotes[drawing.id];

                return (
                  <motion.div key={drawing.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-card rounded-xl border-2 border-foreground overflow-hidden shadow-md">
                    <div className="relative aspect-[4/3] bg-white border-b-2 border-border">
                      <img src={drawing.image_data} className="w-full h-full object-contain" alt="Drawing" />
                      {isMine && <span className="absolute top-2 right-2 bg-primary text-white text-xs px-2 py-1 rounded-full">You</span>}
                    </div>

                    {room.status === "voting" && !isMine && (
                      <div className="p-4 flex flex-col items-center gap-3">
                        <p className="font-handwritten text-lg">Rate this!</p>
                        <div className="flex gap-2">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              onClick={() => handleRate(drawing.id, star)}
                              // Determine if we should fill the star: if hovering or if already voted >= star
                              className={cn("transition-transform hover:scale-125 focus:outline-none", myVote && myVote >= star ? "text-yellow-400 fill-current" : "text-gray-300")}
                              disabled={!!myVote}
                            >
                              <Star className={cn("w-8 h-8", (myVote || 0) >= star && "fill-yellow-400 text-yellow-400")} />
                            </button>
                          ))}
                        </div>
                        {myVote && <p className="text-sm text-green-600 font-bold">Rated {myVote} Stars!</p>}
                      </div>
                    )}
                    {isMine && room.status === "voting" && (
                      <div className="p-4 text-center text-muted-foreground text-sm italic">
                        You cannot vote on your own drawing.
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Round Results */}
          {room.status === "results" && (
            <SketchCard variant="accent">
              <SketchCardContent>
                <h3 className="text-3xl font-handwritten text-center mb-6">Round Results</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {drawings.sort((a, b) => getAverageRating(b.id) - getAverageRating(a.id)).map((d, i) => {
                    const artist = players.find(p => p.id === d.player_id);
                    const avg = getAverageRating(d.id);
                    return (
                      <div key={d.id} className={cn("bg-card rounded-xl overflow-hidden border-2 border-foreground", i === 0 && "ring-4 ring-yellow-400 transform scale-105")}>
                        <img src={d.image_data} className="w-full aspect-[4/3] bg-white object-cover" />
                        <div className="p-3 text-center">
                          <p className="font-bold">{artist?.username}</p>
                          <p className="text-sm text-muted-foreground">{avg.toFixed(1)} Stars</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </SketchCardContent>
            </SketchCard>
          )}
        </div>

        {/* RIGHT COLUMN: SIDEBAR (Leaderboard + Chat) */}
        <div className="lg:col-span-1 flex flex-col gap-6 h-[calc(100vh-2rem)] sticky top-4">
          {/* Leaderboard - Collapsible on mobile? */}
          <div className="bg-card border-2 border-foreground rounded-xl p-4 shadow-sm flex flex-col max-h-[40%] overflow-hidden">
            <h3 className="font-display font-bold text-lg mb-3 flex items-center gap-2"><Trophy className="w-5 h-5 text-yellow-500" /> Leaderboard</h3>
            <div className="overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {players.sort((a, b) => b.score - a.score).map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                  <span className={cn("font-bold w-6 h-6 flex items-center justify-center rounded-full text-xs", i === 0 ? "bg-yellow-400 text-black" : "bg-gray-200")}>{i + 1}</span>
                  <PlayerAvatar username={p.username} color={p.avatar_color} size="sm" showStatus={false} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{p.username}</p>
                  </div>
                  <span className="font-mono font-bold">{p.score}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Chat - Takes remaining height */}
          <div className="bg-card border-2 border-foreground rounded-xl overflow-hidden shadow-sm flex-1 flex flex-col min-h-0 relative">
            <div className="p-3 bg-secondary/50 border-b border-border flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              <span className="font-display font-bold">Room Chat</span>
            </div>
            <div className="flex-1 relative">
              {/* Embed Chat component differently to fit container */}
              <div className="absolute inset-0">
                <Chat />
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Game;
