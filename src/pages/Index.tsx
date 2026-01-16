import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Pencil, Users, Sparkles } from "lucide-react";
import { SketchButton } from "@/components/game/SketchButton";
import { SketchCard, SketchCardContent } from "@/components/game/SketchCard";
import { Input } from "@/components/ui/input";
import { useRoom } from "@/hooks/useRoom";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { createRoom, joinRoom, loading } = useRoom();

  const [username, setUsername] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [secretKey, setSecretKey] = useState("");

  // Modes: 'name' -> 'selection' -> 'create' | 'join'
  const [mode, setMode] = useState<"name" | "selection" | "create" | "join">("name");

  const handleNameSubmit = () => {
    if (!username.trim()) {
      toast({ variant: "destructive", title: "Enter your name!" });
      return;
    }
    setMode("selection");
  };

  const handleCreate = async () => {
    if (secretKey !== "impressMe") {
      toast({ variant: "destructive", title: "Invalid Secret Key!", description: "You are not authorized to create a room." });
      return;
    }

    try {
      const code = await createRoom(username.trim());
      navigate(`/lobby/${code}`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleJoin = async () => {
    if (!roomCode.trim()) {
      toast({ variant: "destructive", title: "Enter a room code!" });
      return;
    }
    try {
      await joinRoom(roomCode.trim().toUpperCase(), username.trim());
      navigate(`/lobby/${roomCode.trim().toUpperCase()}`);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      {/* Floating decorations */}
      <motion.div
        className="absolute top-10 left-10 text-6xl"
        animate={{ y: [0, -10, 0], rotate: [0, 5, 0] }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        ✏️
      </motion.div>
      <motion.div
        className="absolute top-20 right-20 text-5xl"
        animate={{ y: [0, -15, 0], rotate: [0, -5, 0] }}
        transition={{ duration: 4, repeat: Infinity, delay: 0.5 }}
      >
        🎨
      </motion.div>
      <motion.div
        className="absolute bottom-20 left-20 text-4xl"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 2.5, repeat: Infinity, delay: 1 }}
      >
        ⭐
      </motion.div>

      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", duration: 0.6 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-5xl md:text-6xl font-handwritten text-foreground mb-2">
            Draw to <span className="text-primary">Impress</span>
          </h1>
          <p className="text-lg text-muted-foreground font-display">
            Draw. Vote. Win! 🏆
          </p>
        </div>

        <SketchCard className="w-full">
          <SketchCardContent>

            {/* STEP 1: NAME INPUT */}
            {mode === "name" && (
              <div className="space-y-4">
                <h2 className="text-2xl font-handwritten text-center">Who are you?</h2>
                <div>
                  <label className="block text-sm font-display mb-2">Your Name</label>
                  <Input
                    placeholder="Enter your name..."
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="h-12 text-lg border-2 border-foreground rounded-xl"
                    maxLength={20}
                    onKeyDown={(e) => e.key === "Enter" && handleNameSubmit()}
                  />
                </div>
                <SketchButton
                  variant="default"
                  size="lg"
                  onClick={handleNameSubmit}
                  className="w-full"
                  disabled={!username.trim()}
                >
                  Continue
                </SketchButton>
              </div>
            )}

            {/* STEP 2: SELECTION */}
            {mode === "selection" && (
              <div className="space-y-4">
                <div className="text-center mb-4">
                  <p className="font-display text-xl">Hello, <span className="text-primary font-bold">{username}</span>!</p>
                  <p className="text-muted-foreground text-sm">What would you like to do?</p>
                </div>

                <div className="grid grid-cols-1 gap-3 pt-2">
                  <SketchButton
                    variant="accent"
                    size="lg"
                    onClick={() => setMode("join")}
                    className="w-full"
                  >
                    <Users className="w-5 h-5" />
                    Join Existing Room
                  </SketchButton>
                  <SketchButton
                    variant="secondary"
                    size="lg"
                    onClick={() => setMode("create")}
                    className="w-full"
                  >
                    <Pencil className="w-5 h-5" />
                    Create New Room
                  </SketchButton>
                </div>
                <SketchButton
                  variant="ghost"
                  onClick={() => setMode("name")}
                  className="w-full"
                  size="sm"
                >
                  Back
                </SketchButton>
              </div>
            )}

            {/* STEP 3A: CREATE ROOM (PROTECTED) */}
            {mode === "create" && (
              <div className="space-y-4">
                <h2 className="text-2xl font-handwritten text-center">Host Only</h2>
                <div>
                  <label className="block text-sm font-display mb-2">Secret Key</label>
                  <Input
                    type="password"
                    placeholder="Enter admin password..."
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value)}
                    className="h-12 text-lg border-2 border-foreground rounded-xl"
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  />
                </div>
                <SketchButton
                  variant="success"
                  size="xl"
                  onClick={handleCreate}
                  disabled={loading || !secretKey.trim()}
                  className="w-full"
                >
                  <Sparkles className="w-6 h-6" />
                  {loading ? "Creating..." : "Verify & Create"}
                </SketchButton>
                <SketchButton
                  variant="ghost"
                  onClick={() => setMode("selection")}
                  className="w-full"
                >
                  Back
                </SketchButton>
              </div>
            )}

            {/* STEP 3B: JOIN ROOM */}
            {mode === "join" && (
              <div className="space-y-4">
                <h2 className="text-2xl font-handwritten text-center">Join a Room</h2>
                <div>
                  <label className="block text-sm font-display mb-2">Room Code</label>
                  <Input
                    placeholder="ABCDE"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    className="h-12 text-2xl text-center tracking-widest font-mono border-2 border-foreground rounded-xl uppercase"
                    maxLength={5}
                    onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  />
                </div>
                <SketchButton
                  variant="success"
                  size="xl"
                  onClick={handleJoin}
                  disabled={loading || !roomCode.trim()}
                  className="w-full"
                >
                  {loading ? "Joining..." : "Join Game"}
                </SketchButton>
                <SketchButton
                  variant="ghost"
                  onClick={() => setMode("selection")}
                  className="w-full"
                >
                  Back
                </SketchButton>
              </div>
            )}
          </SketchCardContent>
        </SketchCard>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Draw your best. Get the votes. Become the artist! 🎨
        </p>
      </motion.div>
    </div>
  );
};

export default Index;
