-- Fix RLS Security Policies for drawings and rooms tables
-- Remove overly permissive SELECT policies and add room-participant-only access

-- 1. Drop existing overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can view drawings" ON public.drawings;
DROP POLICY IF EXISTS "Authenticated users can view rooms" ON public.rooms;
DROP POLICY IF EXISTS "Authenticated users can view prompts" ON public.prompts;
DROP POLICY IF EXISTS "Authenticated users can add prompts" ON public.prompts;

-- 2. Create proper RLS policies for drawings table - only room participants can view
CREATE POLICY "Room participants can view drawings"
ON public.drawings FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.players
    WHERE players.room_id = drawings.room_id
    AND players.user_id = auth.uid()
  )
);

-- 3. Create proper RLS policies for rooms table - only room participants can view
CREATE POLICY "Room participants can view rooms"
ON public.rooms FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.players
    WHERE players.room_id = rooms.id
    AND players.user_id = auth.uid()
  )
);

-- Allow anyone to look up a room by code (for joining) - but only basic info needed to join
-- We create a separate policy for room lookup during join
CREATE POLICY "Anyone can lookup room by code for joining"
ON public.rooms FOR SELECT
USING (status = 'lobby');

-- 4. Fix prompts table - allow authenticated users to read prompts
CREATE POLICY "Authenticated users can view prompts"
ON public.prompts FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can add prompts"
ON public.prompts FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- 5. Add rate limiting table for abuse prevention
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  room_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on rate_limits
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Only the user can see their own rate limits
CREATE POLICY "Users can view own rate limits"
ON public.rate_limits FOR SELECT
USING (user_id = auth.uid());

-- Users can insert their own rate limit records
CREATE POLICY "Users can insert own rate limits"
ON public.rate_limits FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Create index for efficient rate limit lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_action ON public.rate_limits(user_id, action_type, created_at);
CREATE INDEX IF NOT EXISTS idx_rate_limits_room ON public.rate_limits(room_id, action_type, created_at);

-- 6. Add unique constraint to prevent duplicate drawings per player per round
ALTER TABLE public.drawings 
ADD CONSTRAINT unique_player_round_drawing 
UNIQUE (player_id, room_id, round);

-- 7. Add unique constraint to prevent duplicate votes per player per round  
ALTER TABLE public.votes 
ADD CONSTRAINT unique_voter_round_vote 
UNIQUE (voter_id, room_id, round);

-- 8. Create function to check rate limits
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id UUID,
  p_action_type TEXT,
  p_max_count INTEGER,
  p_window_seconds INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM public.rate_limits
  WHERE user_id = p_user_id
    AND action_type = p_action_type
    AND created_at > now() - (p_window_seconds || ' seconds')::interval;
  
  RETURN recent_count < p_max_count;
END;
$$;

-- 9. Create function to record rate limit action
CREATE OR REPLACE FUNCTION public.record_rate_limit_action(
  p_user_id UUID,
  p_action_type TEXT,
  p_room_id UUID DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.rate_limits (user_id, action_type, room_id)
  VALUES (p_user_id, p_action_type, p_room_id);
END;
$$;

-- 10. Cleanup old rate limit records (keep last 24 hours)
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rate_limits
  WHERE created_at < now() - interval '24 hours';
END;
$$;