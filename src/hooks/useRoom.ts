
import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";
import { getRandomPrompt } from "@/lib/prompts";

export interface Room {
  id: string; // purely for internal ref if needed, but we mostly use 'code'
  code: string;
  host_id: string;
  status: 'lobby' | 'drawing' | 'gallery' | 'voting' | 'results' | 'finished';
  current_round: number;
  total_rounds: number;
  draw_time: number;
  vote_time: number;
  max_players: number;
  current_prompt: string | null;
  phase_end_at: string | null; // ISO string
  used_prompts: string[];
}

export interface Player {
  id: string; // socket/client id
  username: string;
  avatar_color: string;
  score: number;
  is_host: boolean;
  is_ready: boolean; // host is always ready
}

export interface Drawing {
  id: string;
  player_id: string;
  round: number;
  image_data: string;
}

export interface Vote {
  voter_id: string;
  drawing_id: string;
}

// Event payloads
type GameState = {
  room: Room;
  players: Player[];
  drawings: Drawing[];
  votes: Vote[];
};

export const useRoom = () => {
  // Generate a semi-persistent ID for this client session
  const [myId] = useState(() => "user-" + Math.random().toString(36).substr(2, 9));

  // Local State
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);

  // Connection State
  const [status, setStatus] = useState<"idle" | "loading" | "connected" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  // --- Actions ---

  const createRoom = async (username: string, rounds = 3, drawTime = 60) => {
    setStatus("loading");
    const code = Math.floor(1000 + Math.random() * 9000).toString();

    const initialRoom: Room = {
      id: code,
      code,
      host_id: myId,
      status: 'lobby',
      current_round: 0,
      total_rounds: rounds,
      draw_time: drawTime,
      vote_time: 15,
      max_players: 8,
      current_prompt: null,
      phase_end_at: null,
      used_prompts: []
    };

    const me: Player = {
      id: myId,
      username,
      avatar_color: "#FF6B6B", // TODO: random color
      score: 0,
      is_host: true,
      is_ready: true
    };

    setRoom(initialRoom);
    setPlayers([me]);

    await connectToChannel(code, initialRoom, [me]);
    return code;
  };

  const joinRoom = async (code: string, username: string) => {
    setStatus("loading");

    const me: Player = {
      id: myId,
      username,
      avatar_color: "#" + Math.floor(Math.random() * 16777215).toString(16),
      score: 0,
      is_host: false,
      is_ready: false
    };

    // We don't have room state yet, we need to ask for it
    await connectToChannel(code, null, [me]);
  };

  const connectToChannel = async (code: string, initialRoomState: Room | null, initialPlayers: Player[]) => {
    if (channelRef.current) {
      await supabase.removeChannel(channelRef.current);
    }

    const channel = supabase.channel(`room:${code}`, {
      config: {
        presence: {
          key: myId,
        },
        broadcast: { self: true } // receive own events? usually no needed but useful for debugging
      }
    });

    channelRef.current = channel;

    channel
      .on('broadcast' as any, { event: 'gameState' }, (payload: GameState) => {
        // Update local state from authoritative broadcast
        // Optimisation: only update if changed? React handles diffing well enough for this size
        setRoom(payload.room);
        setPlayers(payload.players);
        setDrawings(payload.drawings);
        setVotes(payload.votes);
        setStatus("connected");
      })
      // Guest Requesting State
      .on('broadcast' as any, { event: 'requestState' }, ({ requesterId }: { requesterId: string }) => {
        // Only Host replies
        if (room && room.host_id === myId) {
          broadcastState(room, players, drawings, votes);
        }
      })
      // New Player Joined (via Broadcast for immediate feedback, though Presence handles list)
      .on('broadcast' as any, { event: 'playerJoined' }, ({ player }: { player: Player }) => {
        if (room?.host_id === myId) {
          // Add player if not exists
          setPlayers(current => {
            if (current.find(p => p.id === player.id)) return current;
            const updated = [...current, player];
            // Immediately broadcast new state with this player
            // Need to use the updated array here, not state which might be stale in closure
            // Actually, better pattern: Update state, then external effect broadcasts?
            // For now, let's just do it directly
            broadcastState(room!, updated, drawings, votes);
            return updated;
          });
        }
      })
      // Player Actions
      .on('broadcast' as any, { event: 'submitDrawing' }, ({ drawing }: { drawing: Drawing }) => {
        if (room?.host_id === myId) {
          setDrawings(prev => {
            const next = [...prev, drawing];
            broadcastState(room!, players, next, votes);
            return next;
          });
        }
      })
      .on('broadcast' as any, { event: 'submitVote' }, ({ vote }: { vote: Vote }) => {
        if (room?.host_id === myId) {
          setVotes(prev => {
            const next = [...prev, vote];
            broadcastState(room!, players, drawings, next);
            return next;
          });
        }
      })
      .on('presence', { event: 'sync' }, () => {
        // Can use presence to track active connections if needed
        // const state = channel.presenceState();
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          if (initialRoomState) {
            // We are CREATING/HOSTING
            setStatus("connected");
            // Broadcase initial? No one is listening yet except us
          } else {
            // We are JOINING
            // Send 'playerJoined' request
            // The host will pick it up and add us to their state
            channel.send({
              type: 'broadcast',
              event: 'playerJoined',
              payload: { player: initialPlayers[0] }
            });

            // Also ask for state just in case
            channel.send({
              type: 'broadcast',
              event: 'requestState',
              payload: { requesterId: myId }
            });

            // Wait for response... handled in 'gameState' listener
          }
        }
      });
  };

  const broadcastState = (r: Room, p: Player[], d: Drawing[], v: Vote[]) => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'gameState',
      payload: { room: r, players: p, drawings: d, votes: v }
    });
  };

  // --- Host Functions ---
  // These modify local state and then broadcast it

  // Start Game
  const startGame = async () => {
    if (!room || room.host_id !== myId) return;

    const nextRoom: Room = {
      ...room,
      status: 'drawing',
      current_round: 1,
      current_prompt: getRandomPrompt(),
      phase_end_at: new Date(Date.now() + room.draw_time * 1000).toISOString()
    };

    setRoom(nextRoom);
    setDrawings([]); // Clear drawings
    setVotes([]);
    broadcastState(nextRoom, players, [], []);
  };

  // Host Loop for Timer / Phase changes
  useEffect(() => {
    if (!room || room.host_id !== myId || room.status === 'lobby' || room.status === 'finished') return;

    const interval = setInterval(() => {
      const now = new Date();
      const end = new Date(room.phase_end_at || now);

      if (now >= end) {
        // Phase Complete! Move to next
        let nextRoom = { ...room };

        if (room.status === 'drawing') {
          // -> Gallery
          nextRoom.status = 'gallery';
          nextRoom.phase_end_at = new Date(Date.now() + 5000).toISOString(); // 5s gallery
        } else if (room.status === 'gallery') {
          // -> Voting
          nextRoom.status = 'voting';
          nextRoom.phase_end_at = new Date(Date.now() + room.vote_time * 1000).toISOString();
        } else if (room.status === 'voting') {
          // -> Results
          // Update scores first
          const newPlayers = [...players];
          // Score: 100 points per vote?
          votes.forEach(v => {
            const drawing = drawings.find(d => d.id === v.drawing_id);
            if (drawing) {
              const artist = newPlayers.find(p => p.id === drawing.player_id);
              if (artist) artist.score += 100;
            }
          });
          setPlayers(newPlayers); // Update local host state

          nextRoom.status = 'results';
          nextRoom.phase_end_at = new Date(Date.now() + 10000).toISOString(); // 10s results

          // Broadcast with scores
          broadcastState(nextRoom, newPlayers, drawings, votes);
          setRoom(nextRoom);
          return; // SENT, exit current iter

        } else if (room.status === 'results') {
          // -> Next Round or Finish
          if (room.current_round >= room.total_rounds) {
            nextRoom.status = 'finished';
            nextRoom.phase_end_at = null;
          } else {
            nextRoom.status = 'drawing';
            nextRoom.current_round += 1;
            nextRoom.current_prompt = getRandomPrompt(room.used_prompts);
            nextRoom.used_prompts = [...room.used_prompts, nextRoom.current_prompt!];
            nextRoom.phase_end_at = new Date(Date.now() + room.draw_time * 1000).toISOString();

            // Clear round data
            setDrawings([]);
            setVotes([]);
            broadcastState(nextRoom, players, [], []);
            setRoom(nextRoom);
            return;
          }
        }

        // Default update for other phase changes
        setRoom(nextRoom);
        broadcastState(nextRoom, players, drawings, votes);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [room, players, drawings, votes]); // Re-bind when state changes so we have fresh state


  // --- Client Functions ---

  const submitDrawing = async (imageData: string) => {
    if (!room) return false;

    const drawing: Drawing = {
      id: myId + "-" + room.current_round,
      player_id: myId,
      round: room.current_round,
      image_data: imageData
    };

    // Optimistic local update? No, let's wait for echo or just believe
    // Actually for host it's instant, for guest we send
    if (room.host_id === myId) {
      setDrawings(prev => {
        const next = [...prev, drawing];
        broadcastState(room, players, next, votes);
        return next;
      });
    } else {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'submitDrawing',
        payload: { drawing }
      });
    }
    return true;
  };

  const castVote = async (drawingId: string) => {
    if (!room) return false;

    const vote: Vote = {
      voter_id: myId,
      drawing_id: drawingId
    };

    if (room.host_id === myId) {
      setVotes(prev => {
        const next = [...prev, vote];
        broadcastState(room, players, drawings, next);
        return next;
      });
    } else {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'submitVote',
        payload: { vote }
      });
    }
    return true;
  };

  const toggleReady = () => {
    // Only for guests in lobby
    if (!room || room.status !== 'lobby') return;

    const updatePlayer = (pList: Player[]) => {
      return pList.map(p => p.id === myId ? { ...p, is_ready: !p.is_ready } : p);
    };

    if (room.host_id === myId) {
      // Host is always ready really, but let's allow toggling logic if we wanted start button disabled
      // But 'startGame' is the ready action for host.
      return;
    } else {
      // Send updated "me"
      // Actually, we just need to tell host "I toggled". 
      // Ideally we send "updatePlayer" event
      // For MVP, reuse 'playerJoined' effectively overwrites? 
      // Let's create specific
    }
  };
  // TODO: Add 'toggleReady' real implementation if strict about ready check.
  // For now, let's skip ready check enforcement or assumes 'playerJoined' updates works.
  // Actually, let's just implement 'updateSettings' type logic for players

  const updateSettings = (settings: Partial<Room>) => {
    if (!room || room.host_id !== myId) return;
    const next = { ...room, ...settings };
    setRoom(next);
    broadcastState(next, players, drawings, votes);
  };

  return {
    room,
    players,
    playerId: myId,
    userId: myId, // Compat
    isHost: room?.host_id === myId,
    roomLoadingState: status,
    error,
    createRoom,
    joinRoom,
    startGame,
    submitDrawing,
    castVote,
    updateSettings,
    leaveRoom: async () => {
      if (channelRef.current) await supabase.removeChannel(channelRef.current);
      setRoom(null);
      setStatus("idle");
    },
    rejoinRoom: (code: string) => joinRoom(code, "Rejoining...") // Simple rejoin
  };
};
