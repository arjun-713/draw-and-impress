-- Fix: Player Session IDs and User Identities Exposed to Anyone
-- Change "Anyone can view players in rooms" to require authentication and room participation

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can view players in rooms" ON public.players;

-- Create restrictive policy - only room participants can see other players
CREATE POLICY "Room participants can view players" 
ON public.players 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM players p 
    WHERE p.room_id = players.room_id 
    AND p.user_id = auth.uid()
  )
);

-- Fix: Rooms lookup should require authentication
DROP POLICY IF EXISTS "Anyone can lookup room by code for joining" ON public.rooms;

-- Create policy that requires authentication for room lookup
CREATE POLICY "Authenticated users can lookup lobby rooms by code" 
ON public.rooms 
FOR SELECT 
USING (status = 'lobby' AND auth.uid() IS NOT NULL);