import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Canvas as FabricCanvas, PencilBrush } from "fabric";
import { motion } from "framer-motion";
import { Pencil, Eraser, Undo, Trash2, Vote, Trophy, AlertCircle, Loader2 } from "lucide-react";
import { SketchButton } from "@/components/game/SketchButton";
import { SketchCard, SketchCardContent } from "@/components/game/SketchCard";
import { PlayerAvatar } from "@/components/game/PlayerAvatar";
import { Timer } from "@/components/game/Timer";
import { useRoom } from "@/hooks/useRoom";
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
    checkHasSubmitted 
  } = useRoom();
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [activeColor, setActiveColor] = useState(COLORS[0]);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [votedId, setVotedId] = useState<string | null>(null);
  const [canvasInitialized, setCanvasInitialized] = useState(false);
  
  const currentPlayer = players.find(p => p.id === playerId);

  // Rejoin room on mount if coming from direct link
  useEffect(() => {
    if (code && roomLoadingState === 'idle') {
      rejoinRoom(code);
    }
  }, [code, roomLoadingState, rejoinRoom]);

  // Check submission status on mount and round change
  useEffect(() => {
    const checkSubmission = async () => {
      if (room?.status === 'drawing' && playerId) {
        const submitted = await checkHasSubmitted();
        setHasSubmitted(submitted);
      }
    };
    checkSubmission();
  }, [room?.status, room?.current_round, playerId, checkHasSubmitted]);

  // Initialize canvas - with proper DOM availability check
  useEffect(() => {
    if (!canvasRef.current || fabricCanvas || room?.status !== 'drawing' || hasSubmitted) return;
    
    // Defer canvas initialization to ensure DOM is ready
    const initCanvas = () => {
      if (!canvasRef.current) return;
      
      try {
        const canvas = new FabricCanvas(canvasRef.current, {
          width: 600,
          height: 450,
          backgroundColor: "#ffffff",
          isDrawingMode: true,
          selection: false,
        });
        
        // Set up brush
        const brush = new PencilBrush(canvas);
        brush.color = activeColor;
        brush.width = 4;
        canvas.freeDrawingBrush = brush;
        
        // Ensure canvas accepts pointer events
        const canvasEl = canvas.getElement();
        if (canvasEl) {
          canvasEl.style.touchAction = 'none';
          canvasEl.style.pointerEvents = 'auto';
        }
        
        // Also set on wrapper
        const wrapper = canvasEl?.parentElement;
        if (wrapper) {
          wrapper.style.touchAction = 'none';
          wrapper.style.pointerEvents = 'auto';
        }
        
        setFabricCanvas(canvas);
        setCanvasInitialized(true);
        
      } catch (err) {
        console.error('Canvas initialization error:', err);
        // Retry after a short delay
        setTimeout(initCanvas, 100);
      }
    };
    
    // Use requestAnimationFrame to ensure DOM is painted
    requestAnimationFrame(() => {
      initCanvas();
    });
    
    return () => {
      if (fabricCanvas) {
        fabricCanvas.dispose();
        setFabricCanvas(null);
        setCanvasInitialized(false);
      }
    };
  }, [room?.status, hasSubmitted]);

  // Cleanup canvas on unmount
  useEffect(() => {
    return () => {
      if (fabricCanvas) {
        fabricCanvas.dispose();
      }
    };
  }, [fabricCanvas]);

  // Update brush settings
  useEffect(() => {
    if (!fabricCanvas?.freeDrawingBrush) return;
    fabricCanvas.freeDrawingBrush.color = tool === "eraser" ? "#ffffff" : activeColor;
    fabricCanvas.freeDrawingBrush.width = tool === "eraser" ? 20 : 4;
  }, [tool, activeColor, fabricCanvas]);

  // Reinitialize canvas if drawing is blocked
  const reinitializeCanvas = useCallback(() => {
    if (fabricCanvas) {
      fabricCanvas.dispose();
      setFabricCanvas(null);
      setCanvasInitialized(false);
    }
  }, [fabricCanvas]);

  const handleUndo = useCallback(() => {
    if (!fabricCanvas) return;
    const objects = fabricCanvas.getObjects();
    if (objects.length > 0) {
      fabricCanvas.remove(objects[objects.length - 1]);
    }
  }, [fabricCanvas]);

  const handleClear = useCallback(() => {
    if (!fabricCanvas) return;
    fabricCanvas.clear();
    fabricCanvas.backgroundColor = "#ffffff";
  }, [fabricCanvas]);

  const handleSubmit = useCallback(async () => {
    if (!fabricCanvas || hasSubmitted || isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      const dataUrl = fabricCanvas.toDataURL({ format: "png", quality: 0.8, multiplier: 1 });
      const success = await submitDrawing(dataUrl);
      
      if (success) {
        setHasSubmitted(true);
        // Disable canvas after submission
        fabricCanvas.isDrawingMode = false;
      }
    } catch (err) {
      console.error('Submit error:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [fabricCanvas, hasSubmitted, isSubmitting, submitDrawing]);

  const handleVote = useCallback(async (drawingId: string) => {
    if (votedId) return;
    const success = await castVote(drawingId);
    if (success) {
      setVotedId(drawingId);
    }
  }, [votedId, castVote]);

  // Trigger phase transition check - called when timer completes
  const checkPhaseTransition = useCallback(async () => {
    if (!room?.id) return;
    
    try {
      // Call edge function to check/trigger phase transitions
      await supabase.functions.invoke('game-manager', {
        body: { action: 'transition_room', roomId: room.id }
      });
    } catch (err) {
      console.error('Error checking phase transition:', err);
    }
  }, [room?.id]);

  // Auto-submit when time runs out - this is a client-side fallback
  // Server should handle the authoritative transition
  const handleTimeComplete = useCallback(async () => {
    if (room?.status === "drawing" && !hasSubmitted && !isSubmitting) {
      await handleSubmit();
    }
    // Always try to trigger phase transition when timer completes
    await checkPhaseTransition();
  }, [room?.status, hasSubmitted, isSubmitting, handleSubmit, checkPhaseTransition]);

  // Poll for phase transitions in case timer is out of sync
  useEffect(() => {
    if (!room?.id || room.status === 'lobby' || room.status === 'finished') return;
    
    // Check every 5 seconds if phase should transition
    const interval = setInterval(() => {
      if (room.phase_end_at) {
        const endTime = new Date(room.phase_end_at).getTime();
        if (Date.now() > endTime + 2000) { // 2 second grace period
          checkPhaseTransition();
        }
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [room?.id, room?.status, room?.phase_end_at, checkPhaseTransition]);

  // Reset state on round/status change
  useEffect(() => {
    if (room?.status === 'drawing') {
      setVotedId(null);
      setHasSubmitted(false); // Reset for new round
    } else if (room?.status === 'voting') {
      setVotedId(null);
    }
  }, [room?.status, room?.current_round]);

  // Navigate to results when game ends
  useEffect(() => {
    if (room?.status === "finished") {
      navigate(`/results/${code}`);
    }
  }, [room?.status, code, navigate]);

  // Loading state
  if (roomLoadingState === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="text-xl font-display">Loading game...</p>
      </div>
    );
  }

  // Error state
  if (roomLoadingState === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <p className="text-xl font-display text-destructive">{error || 'Failed to load game'}</p>
        <SketchButton onClick={() => navigate('/')}>
          Go Home
        </SketchButton>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="text-xl font-display">Loading...</p>
      </div>
    );
  }

  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="min-h-screen p-4 bg-background">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">Round {room.current_round}/{room.total_rounds}</span>
            <span className="px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-sm font-medium capitalize">
              {room.status}
            </span>
          </div>
          <Timer endTime={room.phase_end_at} onComplete={handleTimeComplete} />
        </div>

        {/* Prompt */}
        <motion.div 
          className="text-center mb-6"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <p className="text-sm text-muted-foreground mb-1">Draw:</p>
          <h2 className="text-3xl md:text-4xl font-handwritten text-primary">
            {room.current_prompt || "Loading..."}
          </h2>
        </motion.div>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Main Area */}
          <div className="lg:col-span-3">
            {room.status === "drawing" && (
              <SketchCard>
                <SketchCardContent>
                  {/* Toolbar */}
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <div className="flex gap-1">
                      {COLORS.map(color => (
                        <button
                          key={color}
                          onClick={() => { setActiveColor(color); setTool("pen"); }}
                          className={cn(
                            "w-8 h-8 rounded-full border-2 border-foreground transition-transform",
                            activeColor === color && tool === "pen" && "ring-2 ring-offset-2 ring-primary scale-110"
                          )}
                          style={{ backgroundColor: color }}
                          disabled={hasSubmitted}
                        />
                      ))}
                    </div>
                    <div className="flex gap-2 ml-auto">
                      <SketchButton 
                        size="icon" 
                        variant={tool === "pen" ? "default" : "outline"} 
                        onClick={() => setTool("pen")}
                        disabled={hasSubmitted}
                      >
                        <Pencil />
                      </SketchButton>
                      <SketchButton 
                        size="icon" 
                        variant={tool === "eraser" ? "default" : "outline"} 
                        onClick={() => setTool("eraser")}
                        disabled={hasSubmitted}
                      >
                        <Eraser />
                      </SketchButton>
                      <SketchButton 
                        size="icon" 
                        variant="outline" 
                        onClick={handleUndo}
                        disabled={hasSubmitted}
                      >
                        <Undo />
                      </SketchButton>
                      <SketchButton 
                        size="icon" 
                        variant="destructive" 
                        onClick={handleClear}
                        disabled={hasSubmitted}
                      >
                        <Trash2 />
                      </SketchButton>
                      {!canvasInitialized && !hasSubmitted && (
                        <SketchButton 
                          size="icon" 
                          variant="outline" 
                          onClick={reinitializeCanvas}
                          title="Reinitialize canvas"
                        >
                          <AlertCircle className="text-warning" />
                        </SketchButton>
                      )}
                    </div>
                  </div>
                  
                  {/* Canvas Container - ensure pointer events work */}
                  <div 
                    ref={canvasContainerRef}
                    className="border-3 border-foreground rounded-xl overflow-hidden bg-canvas mx-auto relative"
                    style={{ 
                      maxWidth: 600, 
                      touchAction: 'none',
                      pointerEvents: hasSubmitted ? 'none' : 'auto'
                    }}
                  >
                    <canvas 
                      ref={canvasRef} 
                      className="w-full"
                      style={{ 
                        touchAction: 'none',
                        pointerEvents: hasSubmitted ? 'none' : 'auto'
                      }}
                    />
                    {hasSubmitted && (
                      <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
                        <p className="text-lg font-display text-success">Submitted ✓</p>
                      </div>
                    )}
                  </div>
                  
                  {hasSubmitted ? (
                    <p className="text-center mt-4 text-success font-display">Drawing submitted! ✓</p>
                  ) : (
                    <SketchButton 
                      variant="success" 
                      size="lg" 
                      className="w-full mt-4" 
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin mr-2" />
                          Submitting...
                        </>
                      ) : (
                        'Submit Drawing'
                      )}
                    </SketchButton>
                  )}
                </SketchCardContent>
              </SketchCard>
            )}

            {(room.status === "gallery" || room.status === "voting") && (
              <SketchCard>
                <SketchCardContent>
                  <h3 className="text-2xl font-handwritten text-center mb-4">
                    {room.status === "gallery" ? "Gallery View" : "Vote for the Best!"}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {drawings.map((drawing, i) => {
                      const isOwn = drawing.player_id === playerId;
                      return (
                        <motion.div
                          key={drawing.id}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: i * 0.1 }}
                          className={cn(
                            "border-3 border-foreground rounded-xl overflow-hidden bg-canvas cursor-pointer transition-transform",
                            room.status === "voting" && !isOwn && !votedId && "hover:scale-105",
                            votedId === drawing.id && "ring-4 ring-success"
                          )}
                          onClick={() => room.status === "voting" && !isOwn && handleVote(drawing.id)}
                        >
                          <img src={drawing.image_data} alt="Drawing" className="w-full aspect-[4/3] object-cover" />
                          {room.status === "voting" && !isOwn && !votedId && (
                            <div className="p-2 bg-accent text-center">
                              <Vote className="w-4 h-4 inline mr-1" /> Vote
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                  {drawings.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      Waiting for drawings...
                    </p>
                  )}
                </SketchCardContent>
              </SketchCard>
            )}

            {room.status === "results" && (
              <SketchCard variant="accent">
                <SketchCardContent className="text-center py-8">
                  <Trophy className="w-16 h-16 mx-auto text-warning mb-4" />
                  <h3 className="text-3xl font-handwritten mb-4">Round {room.current_round} Results!</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {drawings.sort((a, b) => b.vote_count - a.vote_count).map((drawing) => {
                      const artist = players.find(p => p.id === drawing.player_id);
                      return (
                        <div key={drawing.id} className="border-3 border-foreground rounded-xl overflow-hidden bg-canvas">
                          <img src={drawing.image_data} alt="Drawing" className="w-full aspect-[4/3] object-cover" />
                          <div className="p-2 bg-card text-center">
                            <p className="font-display font-medium">{artist?.username}</p>
                            <p className="text-sm text-muted-foreground">{drawing.vote_count} votes</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </SketchCardContent>
              </SketchCard>
            )}
          </div>

          {/* Leaderboard */}
          <div>
            <SketchCard variant="muted">
              <SketchCardContent>
                <h3 className="text-xl font-handwritten mb-4 text-center">Leaderboard</h3>
                <div className="space-y-3">
                  {sortedPlayers.map((player, i) => (
                    <div key={player.id} className="flex items-center gap-3">
                      <span className="w-6 text-center font-bold">{i + 1}</span>
                      <PlayerAvatar
                        username={player.username}
                        color={player.avatar_color}
                        size="sm"
                        showStatus={false}
                      />
                      <span className="ml-auto font-display font-bold">{player.score}</span>
                    </div>
                  ))}
                </div>
              </SketchCardContent>
            </SketchCard>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Game;
