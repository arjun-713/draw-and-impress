import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useGameStore, Room, Player, Drawing, getRandomAvatarColor, generateRoomCode } from '@/lib/gameStore';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

type RoomLoadingState = 'idle' | 'loading' | 'joined' | 'error';

const ROOM_LOAD_TIMEOUT = 8000; // 8 seconds

export const useRoom = () => {
  const { toast } = useToast();
  const { userId, loading: authLoading } = useAuth();
  const { playerId, setPlayer, roomCode, setRoom, clearGame } = useGameStore();
  
  const [room, setRoomState] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roomLoadingState, setRoomLoadingState] = useState<RoomLoadingState>('idle');
  
  // Track if we've initialized to avoid duplicate fetches
  const initRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch room data by code
  const fetchRoom = useCallback(async (code: string) => {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', code)
      .maybeSingle();
    
    if (error) throw error;
    return data as Room | null;
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

  // Check if user is already in room
  const checkUserInRoom = useCallback(async (roomId: string): Promise<Player | null> => {
    if (!userId) return null;
    
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle();
    
    if (error) return null;
    return data as Player | null;
  }, [userId]);

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
      setRoomLoadingState('joined');
      
      return code;
    } catch (err: any) {
      setError(err.message);
      setRoomLoadingState('error');
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
    setRoomLoadingState('loading');
    
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
        setRoomLoadingState('joined');
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
      setRoomLoadingState('joined');
      
    } catch (err: any) {
      setError(err.message);
      setRoomLoadingState('error');
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

  // Rejoin room from URL (for direct links / refresh)
  const rejoinRoom = useCallback(async (code: string): Promise<boolean> => {
    if (!userId || authLoading) return false;
    
    setRoomLoadingState('loading');
    setError(null);
    
    // Set up timeout
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (roomLoadingState === 'loading') {
        setRoomLoadingState('error');
        setError('Room loading timed out');
      }
    }, ROOM_LOAD_TIMEOUT);
    
    try {
      const roomData = await fetchRoom(code.toUpperCase());
      
      if (!roomData) {
        setRoomLoadingState('error');
        setError('Room not found');
        return false;
      }
      
      // Check if user is in this room
      const existingPlayer = await checkUserInRoom(roomData.id);
      
      if (!existingPlayer) {
        // User not in room - they can join if it's in lobby
        if (roomData.status === 'lobby') {
          setRoomLoadingState('idle'); // Allow join form to show
          setRoomState(roomData);
          return false;
        } else {
          setRoomLoadingState('error');
          setError('Game in progress - you are not a participant');
          return false;
        }
      }
      
      // User is in room - restore their session
      setPlayer(existingPlayer.id, existingPlayer.username);
      setRoom(code.toUpperCase());
      setRoomState(roomData);
      setPlayers(await fetchPlayers(roomData.id));
      
      if (roomData.current_round > 0) {
        const drawingsData = await fetchDrawings(roomData.id, roomData.current_round);
        setDrawings(drawingsData);
      }
      
      setRoomLoadingState('joined');
      
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      return true;
      
    } catch (err: any) {
      console.error('Error rejoining room:', err);
      setRoomLoadingState('error');
      setError(err.message);
      return false;
    }
  }, [userId, authLoading, fetchRoom, fetchPlayers, fetchDrawings, checkUserInRoom, setPlayer, setRoom, roomLoadingState]);

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
      setRoomLoadingState('idle');
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

  // Submit drawing with idempotency
  const submitDrawing = useCallback(async (imageData: string): Promise<boolean> => {
    if (!room?.id || !playerId) return false;
    
    try {
      // Use upsert to handle duplicate submissions gracefully
      const { error: drawingError } = await supabase
        .from('drawings')
        .upsert({
          room_id: room.id,
          player_id: playerId,
          round: room.current_round,
          image_data: imageData,
        }, {
          onConflict: 'player_id,room_id,round',
          ignoreDuplicates: false
        });
      
      if (drawingError) {
        // If it's a duplicate error, consider it a success (already submitted)
        if (drawingError.code === '23505') {
          return true;
        }
        throw drawingError;
      }
      
      return true;
    } catch (err: any) {
      console.error('Error submitting drawing:', err);
      toast({
        variant: 'destructive',
        title: 'Submission failed',
        description: err.message,
      });
      return false;
    }
  }, [room?.id, room?.current_round, playerId, toast]);

  // Cast vote
  const castVote = useCallback(async (drawingId: string): Promise<boolean> => {
    if (!room?.id || !playerId) return false;
    
    try {
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
          return false;
        }
        throw voteError;
      }
      
      return true;
    } catch (err: any) {
      console.error('Error casting vote:', err);
      toast({
        variant: 'destructive',
        title: 'Vote failed',
        description: err.message,
      });
      return false;
    }
  }, [room?.id, room?.current_round, playerId, toast]);

  // Check if current player has submitted for current round
  const checkHasSubmitted = useCallback(async (): Promise<boolean> => {
    if (!room?.id || !playerId || room.current_round <= 0) return false;
    
    const { data } = await supabase
      .from('drawings')
      .select('id')
      .eq('room_id', room.id)
      .eq('player_id', playerId)
      .eq('round', room.current_round)
      .maybeSingle();
    
    return !!data;
  }, [room?.id, room?.current_round, playerId]);

  // Subscribe to realtime updates - with proper cleanup
  useEffect(() => {
    if (!roomCode || authLoading || !userId) return;
    
    // Avoid duplicate initialization
    if (initRef.current) return;
    initRef.current = true;
    
    const loadInitialData = async () => {
      try {
        setRoomLoadingState('loading');
        const roomData = await fetchRoom(roomCode);
        
        if (!roomData) {
          setRoomLoadingState('error');
          setError('Room not found');
          return;
        }
        
        setRoomState(roomData);
        
        const playersData = await fetchPlayers(roomData.id);
        setPlayers(playersData);
        
        // Verify current user is in room
        const isUserInRoom = playersData.some(p => p.user_id === userId);
        if (!isUserInRoom) {
          setRoomLoadingState('idle'); // Can show join form
          return;
        }
        
        if (roomData.current_round > 0) {
          const drawingsData = await fetchDrawings(roomData.id, roomData.current_round);
          setDrawings(drawingsData);
        }
        
        setRoomLoadingState('joined');
      } catch (err: any) {
        console.error('Error loading room data:', err);
        setRoomLoadingState('error');
        setError(err.message);
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
    
    // Subscribe to player changes - refetch on any change
    const playersChannel = supabase
      .channel(`players-${roomCode}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players' },
        async () => {
          if (room?.id) {
            try {
              const playersData = await fetchPlayers(room.id);
              setPlayers(playersData);
            } catch (err) {
              console.error('Error refetching players:', err);
            }
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
            try {
              const drawingsData = await fetchDrawings(room.id, room.current_round);
              setDrawings(drawingsData);
            } catch (err) {
              console.error('Error refetching drawings:', err);
            }
          }
        }
      )
      .subscribe();
    
    return () => {
      initRef.current = false;
      supabase.removeChannel(roomChannel);
      supabase.removeChannel(playersChannel);
      supabase.removeChannel(drawingsChannel);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [roomCode, room?.id, room?.current_round, authLoading, userId, fetchRoom, fetchPlayers, fetchDrawings]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return {
    room,
    players,
    drawings,
    loading: loading || authLoading,
    error,
    playerId,
    userId,
    roomLoadingState,
    createRoom,
    joinRoom,
    rejoinRoom,
    leaveRoom,
    toggleReady,
    updateSettings,
    startGame,
    submitDrawing,
    castVote,
    checkHasSubmitted,
  };
};
