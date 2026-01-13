import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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

Deno.serve(async (req) => {
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

  } catch (error) {
    console.error('Error in game-manager:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function transitionRoom(
  supabase: ReturnType<typeof createClient>,
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
  supabase: ReturnType<typeof createClient>,
  roomId: string,
  round: number
): Promise<void> {
  // Get all drawings for this round with their vote counts
  const { data: drawings, error: drawingsError } = await supabase
    .from('drawings')
    .select('id, player_id, vote_count')
    .eq('room_id', roomId)
    .eq('round', round);

  if (drawingsError || !drawings) {
    console.error('Error fetching drawings for scoring:', drawingsError);
    return;
  }

  // Update scores for each player based on votes received
  // 1 point per vote received
  for (const drawing of drawings as Drawing[]) {
    if (drawing.vote_count > 0) {
      const { error: scoreError } = await supabase.rpc('increment_player_score', {
        p_player_id: drawing.player_id,
        p_points: drawing.vote_count,
      });
      
      if (scoreError) {
        // Fallback: direct update
        const { data: player } = await supabase
          .from('players')
          .select('score')
          .eq('id', drawing.player_id)
          .single();
        
        if (player) {
          await supabase
            .from('players')
            .update({ score: player.score + drawing.vote_count })
            .eq('id', drawing.player_id);
        }
      }
    }
  }
}
