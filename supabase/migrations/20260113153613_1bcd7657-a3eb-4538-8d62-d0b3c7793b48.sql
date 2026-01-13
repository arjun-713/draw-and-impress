-- Update players table to use auth.uid() instead of client-side session_id
-- Add user_id column to players table for proper authentication
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop existing overly permissive policies on players table
DROP POLICY IF EXISTS "Anyone can join as player" ON public.players;
DROP POLICY IF EXISTS "Anyone can leave room" ON public.players;
DROP POLICY IF EXISTS "Anyone can update players" ON public.players;
DROP POLICY IF EXISTS "Anyone can view players" ON public.players;

-- Create proper RLS policies for players table
-- Anyone can view players in a room (needed for lobby display)
CREATE POLICY "Anyone can view players in rooms"
ON public.players
FOR SELECT
TO authenticated
USING (true);

-- Players can only insert their own records
CREATE POLICY "Players can create their own record"
ON public.players
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Players can only update their own records
CREATE POLICY "Players can only update own data"
ON public.players
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Players can only delete their own records
CREATE POLICY "Players can only delete own data"
ON public.players
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Update rooms table policies
DROP POLICY IF EXISTS "Anyone can create rooms" ON public.rooms;
DROP POLICY IF EXISTS "Anyone can update rooms" ON public.rooms;
DROP POLICY IF EXISTS "Anyone can view rooms" ON public.rooms;

-- Anyone authenticated can view rooms
CREATE POLICY "Authenticated users can view rooms"
ON public.rooms
FOR SELECT
TO authenticated
USING (true);

-- Anyone authenticated can create rooms
CREATE POLICY "Authenticated users can create rooms"
ON public.rooms
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Only host can update room (check via players table)
CREATE POLICY "Only host can update room"
ON public.rooms
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.players 
    WHERE players.room_id = rooms.id 
    AND players.user_id = auth.uid() 
    AND players.is_host = true
  )
);

-- Update drawings table policies
DROP POLICY IF EXISTS "Anyone can submit drawings" ON public.drawings;
DROP POLICY IF EXISTS "Anyone can view drawings" ON public.drawings;
DROP POLICY IF EXISTS "No direct drawing updates allowed" ON public.drawings;

-- Anyone authenticated can view drawings
CREATE POLICY "Authenticated users can view drawings"
ON public.drawings
FOR SELECT
TO authenticated
USING (true);

-- Players can only submit their own drawings
CREATE POLICY "Players can submit own drawings"
ON public.drawings
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.players 
    WHERE players.id = drawings.player_id 
    AND players.user_id = auth.uid()
  )
);

-- No direct updates to drawings (vote_count managed by trigger)
CREATE POLICY "No direct drawing updates"
ON public.drawings
FOR UPDATE
TO authenticated
USING (false);

-- Update votes table policies
DROP POLICY IF EXISTS "Anyone can cast votes" ON public.votes;
DROP POLICY IF EXISTS "Anyone can view votes" ON public.votes;

-- Anyone authenticated can view votes
CREATE POLICY "Authenticated users can view votes"
ON public.votes
FOR SELECT
TO authenticated
USING (true);

-- Players can only cast votes as themselves
CREATE POLICY "Players can cast own votes"
ON public.votes
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.players 
    WHERE players.id = votes.voter_id 
    AND players.user_id = auth.uid()
  )
);

-- Update prompts table policies
DROP POLICY IF EXISTS "Anyone can add custom prompts" ON public.prompts;
DROP POLICY IF EXISTS "Anyone can view prompts" ON public.prompts;

-- Anyone authenticated can view prompts
CREATE POLICY "Authenticated users can view prompts"
ON public.prompts
FOR SELECT
TO authenticated
USING (true);

-- Anyone authenticated can add prompts
CREATE POLICY "Authenticated users can add prompts"
ON public.prompts
FOR INSERT
TO authenticated
WITH CHECK (true);