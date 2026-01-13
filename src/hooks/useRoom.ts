import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useGameStore, Room, Player, Drawing, getRandomAvatarColor, generateRoomCode } from '@/lib/gameStore';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export const useRoom = () => {
  const { toast } = useToast();
  const { userId, loading: authLoading } = useAuth();
  const { playerId, setPlayer, roomCode, setRoom, clearGame } = useGameStore();
  
  const [room, setRoomState] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch room data
  const fetchRoom = useCallback(async (code: string) => {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', code)
      .single();
    
    if (error) throw error;
    return data as Room;
  }, []);

  // Fetch players in room
  const fetchPlayers = useCallback(async (roomId: string) => {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    return data as Player[];
  }, []);

  // Fetch drawings for current round
  const fetchDrawings = useCallback(async (roomId: string, round: number) => {
    const { data, error } = await supabase
      .from('drawings')
      .select('*')
      .eq('room_id', roomId)
      .eq('round', round);
    
    if (error) throw error;
    return data as Drawing[];
  }, []);

  // Create a new room
  const createRoom = useCallback(async (username: string): Promise<string> => {
    if (!userId) {
      throw new Error('Not authenticated');
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const code = generateRoomCode();
      
      // Create room with auth.uid() as host_id
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .insert({
          code,
          host_id: userId,
          status: 'lobby',
        })
        .select()
        .single();
      
      if (roomError) throw roomError;
      
      // Create player (host) with user_id for RLS
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .insert({
          room_id: roomData.id,
          session_id: userId,
          user_id: userId,
          username,
          avatar_color: getRandomAvatarColor(),
          is_host: true,
        })
        .select()
        .single();
      
      if (playerError) throw playerError;
      
      setPlayer(playerData.id, username);
      setRoom(code);
      setRoomState(roomData as Room);
      
      return code;
    } catch (err: any) {
      setError(err.message);
      toast({
        variant: 'destructive',
        title: 'Error creating room',
        description: err.message,
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [userId, setPlayer, setRoom, toast]);

  // Join an existing room
  const joinRoom = useCallback(async (code: string, username: string): Promise<void> => {
    if (!userId) {
      throw new Error('Not authenticated');
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const roomData = await fetchRoom(code.toUpperCase());
      
      if (!roomData) {
        throw new Error('Room not found');
      }
      
      if (roomData.status !== 'lobby') {
        throw new Error('Game already in progress');
      }
      
      const currentPlayers = await fetchPlayers(roomData.id);
      
      if (currentPlayers.length >= roomData.max_players) {
        throw new Error('Room is full');
      }
      
      // Check if player already in room using user_id
      const existingPlayer = currentPlayers.find(p => p.user_id === userId);
      
      if (existingPlayer) {
        setPlayer(existingPlayer.id, existingPlayer.username);
        setRoom(code.toUpperCase());
        setRoomState(roomData);
        return;
      }
      
      // Create new player with user_id for RLS
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .insert({
          room_id: roomData.id,
          session_id: userId,
          user_id: userId,
          username,
          avatar_color: getRandomAvatarColor(),
        })
        .select()
        .single();
      
      if (playerError) throw playerError;
      
      setPlayer(playerData.id, username);
      setRoom(code.toUpperCase());
      setRoomState(roomData);
      
    } catch (err: any) {
      setError(err.message);
      toast({
        variant: 'destructive',
        title: 'Error joining room',
        description: err.message,
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [userId, setPlayer, setRoom, fetchRoom, fetchPlayers, toast]);

  // Leave room
  const leaveRoom = useCallback(async () => {
    if (!playerId) return;
    
    try {
      await supabase
        .from('players')
        .delete()
        .eq('id', playerId);
      
      clearGame();
      setRoomState(null);
      setPlayers([]);
    } catch (err: any) {
      console.error('Error leaving room:', err);
    }
  }, [playerId, clearGame]);

  // Toggle ready status
  const toggleReady = useCallback(async () => {
    if (!playerId) return;
    
    const currentPlayer = players.find(p => p.id === playerId);
    if (!currentPlayer) return;
    
    await supabase
      .from('players')
      .update({ is_ready: !currentPlayer.is_ready })
      .eq('id', playerId);
  }, [playerId, players]);

  // Update room settings (host only)
  const updateSettings = useCallback(async (settings: Partial<Room>) => {
    if (!room?.id) return;
    
    await supabase
      .from('rooms')
      .update(settings)
      .eq('id', room.id);
  }, [room?.id]);

  // Start game (host only)
  const startGame = useCallback(async () => {
    if (!room?.id) return;
    
    // Get random prompt
    const { data: prompts } = await supabase
      .from('prompts')
      .select('text')
      .limit(100);
    
    const randomPrompt = prompts?.[Math.floor(Math.random() * (prompts?.length || 1))]?.text || 'Draw something!';
    
    const phaseEndAt = new Date(Date.now() + room.draw_time * 1000).toISOString();
    
    await supabase
      .from('rooms')
      .update({
        status: 'drawing',
        current_round: 1,
        current_prompt: randomPrompt,
        phase_end_at: phaseEndAt,
      })
      .eq('id', room.id);
  }, [room]);

  // Submit drawing
  const submitDrawing = useCallback(async (imageData: string) => {
    if (!room?.id || !playerId) return;
    
    await supabase
      .from('drawings')
      .insert({
        room_id: room.id,
        player_id: playerId,
        round: room.current_round,
        image_data: imageData,
      });
  }, [room?.id, room?.current_round, playerId]);

  // Cast vote
  const castVote = useCallback(async (drawingId: string) => {
    if (!room?.id || !playerId) return;
    
    // Check if already voted
    const { data: existingVote } = await supabase
      .from('votes')
      .select('id')
      .eq('voter_id', playerId)
      .eq('round', room.current_round)
      .single();
    
    if (existingVote) {
      toast({
        variant: 'destructive',
        title: 'Already voted',
        description: 'You can only vote once per round',
      });
      return;
    }
    
    // Cast vote - vote_count is automatically updated by database trigger
    const { error: voteError } = await supabase
      .from('votes')
      .insert({
        room_id: room.id,
        voter_id: playerId,
        drawing_id: drawingId,
        round: room.current_round,
      });
    
    if (voteError) {
      // Handle duplicate vote attempts (UNIQUE constraint violation)
      if (voteError.code === '23505') {
        toast({
          variant: 'destructive',
          title: 'Already voted',
          description: 'You can only vote once per round',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Vote failed',
          description: voteError.message,
        });
      }
    }
    
  }, [room?.id, room?.current_round, playerId, toast]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!roomCode || authLoading) return;
    
    const loadInitialData = async () => {
      try {
        const roomData = await fetchRoom(roomCode);
        setRoomState(roomData);
        
        const playersData = await fetchPlayers(roomData.id);
        setPlayers(playersData);
        
        if (roomData.current_round > 0) {
          const drawingsData = await fetchDrawings(roomData.id, roomData.current_round);
          setDrawings(drawingsData);
        }
      } catch (err) {
        console.error('Error loading room data:', err);
      }
    };
    
    loadInitialData();
    
    // Subscribe to room changes
    const roomChannel = supabase
      .channel(`room-${roomCode}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms', filter: `code=eq.${roomCode}` },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setRoomState(payload.new as Room);
          }
        }
      )
      .subscribe();
    
    // Subscribe to player changes
    const playersChannel = supabase
      .channel(`players-${roomCode}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players' },
        async () => {
          // Refetch players on any change
          if (room?.id) {
            const playersData = await fetchPlayers(room.id);
            setPlayers(playersData);
          }
        }
      )
      .subscribe();
    
    // Subscribe to drawings
    const drawingsChannel = supabase
      .channel(`drawings-${roomCode}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'drawings' },
        async () => {
          if (room?.id && room.current_round > 0) {
            const drawingsData = await fetchDrawings(room.id, room.current_round);
            setDrawings(drawingsData);
          }
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(roomChannel);
      supabase.removeChannel(playersChannel);
      supabase.removeChannel(drawingsChannel);
    };
  }, [roomCode, room?.id, room?.current_round, authLoading, fetchRoom, fetchPlayers, fetchDrawings]);

  return {
    room,
    players,
    drawings,
    loading: loading || authLoading,
    error,
    playerId,
    userId,
    createRoom,
    joinRoom,
    leaveRoom,
    toggleReady,
    updateSettings,
    startGame,
    submitDrawing,
    castVote,
  };
};
