import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Room {
  id: string;
  code: string;
  status: string;
  current_round: number;
  total_rounds: number;
  draw_time: number;
  vote_time: number;
  phase_end_at: string | null;
  current_prompt: string | null;
}

interface Drawing {
  id: string;
  player_id: string;
  vote_count: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, roomId } = await req.json();

    if (action === 'check_phase_transitions') {
      // Find all rooms that need phase transitions
      const now = new Date().toISOString();

      const { data: expiredRooms, error: roomsError } = await supabase
        .from('rooms')
        .select('*')
        .not('status', 'in', '("lobby","finished")')
        .not('phase_end_at', 'is', null)
        .lt('phase_end_at', now);

      if (roomsError) throw roomsError;

      const transitions: { roomId: string; from: string; to: string }[] = [];

      for (const room of (expiredRooms || []) as Room[]) {
        const transition = await transitionRoom(supabase, room);
        if (transition) {
          transitions.push(transition);
        }
      }

      return new Response(
        JSON.stringify({ success: true, transitions }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'transition_room' && roomId) {
      // Manually trigger a transition for a specific room
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (roomError) throw roomError;

      const transition = await transitionRoom(supabase, room as Room);

      return new Response(
        JSON.stringify({ success: true, transition }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in game-manager:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function transitionRoom(
  supabase: any,
  room: Room
): Promise<{ roomId: string; from: string; to: string } | null> {
  const { id, status, current_round, total_rounds, draw_time, vote_time } = room;

  let newStatus: string;
  let newPhaseEndAt: string | null = null;
  let newRound = current_round;
  let newPrompt = room.current_prompt;

  switch (status) {
    case 'drawing':
      // Transition to gallery/voting
      newStatus = 'voting';
      newPhaseEndAt = new Date(Date.now() + vote_time * 1000).toISOString();
      break;

    case 'voting':
      // Transition to results
      newStatus = 'results';
      // Give 10 seconds to view results
      newPhaseEndAt = new Date(Date.now() + 10000).toISOString();

      // Update player scores based on votes
      await updateScoresFromVotes(supabase, id, current_round);
      break;

    case 'results':
      // Check if we need another round or finish
      if (current_round >= total_rounds) {
        newStatus = 'finished';
        newPhaseEndAt = null;
      } else {
        // Start next round
        newStatus = 'drawing';
        newRound = current_round + 1;
        newPhaseEndAt = new Date(Date.now() + draw_time * 1000).toISOString();

        // Get a new random prompt
        const { data: prompts } = await supabase
          .from('prompts')
          .select('text')
          .limit(100);

        if (prompts && prompts.length > 0) {
          newPrompt = prompts[Math.floor(Math.random() * prompts.length)].text;
        }
      }
      break;

    case 'gallery':
      // Transition to voting
      newStatus = 'voting';
      newPhaseEndAt = new Date(Date.now() + vote_time * 1000).toISOString();
      break;

    default:
      return null;
  }

  // Update the room
  const { error: updateError } = await supabase
    .from('rooms')
    .update({
      status: newStatus,
      current_round: newRound,
      phase_end_at: newPhaseEndAt,
      current_prompt: newPrompt,
    })
    .eq('id', id);

  if (updateError) {
    console.error('Error updating room:', updateError);
    return null;
  }

  console.log(`Room ${id}: ${status} -> ${newStatus}`);
  return { roomId: id, from: status, to: newStatus };
}

async function updateScoresFromVotes(
  supabase: any,
  roomId: string,
  round: number
): Promise<void> {
  // Get all votes for this round
  const { data: votes, error: votesError } = await supabase
    .from('votes')
    .select('drawing_id, rating, drawing:drawings(player_id)')
    .eq('room_id', roomId)
    .eq('round', round);

  if (votesError || !votes) {
    console.error('Error fetching votes for scoring:', votesError);
    return;
  }

  // Calculate scores per drawing/player
  const scores: Record<string, number> = {};

  // Group votes by drawing
  const drawingVotes: Record<string, number[]> = {};

  votes.forEach((v: any) => {
    if (!v.drawing_id) return;
    if (!drawingVotes[v.drawing_id]) drawingVotes[v.drawing_id] = [];
    drawingVotes[v.drawing_id].push(v.rating || 0);
  });

  // Calculate Average * 10 (or similar scaling)
  for (const [drawingId, ratings] of Object.entries(drawingVotes)) {
    if (ratings.length === 0) continue;
    const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    const points = Math.round(avg * 100); // e.g. 4.5 stars -> 450 points

    // Find player for this drawing
    const vote = votes.find((v: any) => v.drawing_id === drawingId);
    const playerId = vote?.drawing?.player_id;

    if (playerId) {
      if (!scores[playerId]) scores[playerId] = 0;
      scores[playerId] += points;
    }
  }

  // Update scores in DB
  for (const [playerId, points] of Object.entries(scores)) {
    const { error: scoreError } = await supabase.rpc('increment_player_score', {
      p_player_id: playerId,
      p_points: points,
    });

    if (scoreError) {
      // Fallback
      const { data: player } = await supabase
        .from('players')
        .select('score')
        .eq('id', playerId)
        .single();

      if (player) {
        await supabase
          .from('players')
          .update({ score: (player.score || 0) + points })
          .eq('id', playerId);
      }
    }
  }
}
