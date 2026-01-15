-- Fix infinite recursion in players RLS policy
-- The current policy references players table inside itself, causing infinite recursion

-- First, create a security definer function to check room participation
CREATE OR REPLACE FUNCTION public.is_room_participant(p_room_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.players
    WHERE room_id = p_room_id
    AND user_id = p_user_id
  );
$$;

-- Drop the recursive policy
DROP POLICY IF EXISTS "Room participants can view players" ON public.players;

-- Create a non-recursive policy using the security definer function
CREATE POLICY "Room participants can view players" 
ON public.players 
FOR SELECT 
USING (
  public.is_room_participant(room_id, auth.uid())
);

-- Fix rooms table policies that also cause recursion
DROP POLICY IF EXISTS "Room participants can view rooms" ON public.rooms;

-- Create a security definer function to check if user is in a room by room ID
CREATE OR REPLACE FUNCTION public.user_is_in_room(p_room_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.players
    WHERE room_id = p_room_id
    AND user_id = auth.uid()
  );
$$;

-- Create non-recursive policy for rooms
CREATE POLICY "Room participants can view rooms" 
ON public.rooms 
FOR SELECT 
USING (
  public.user_is_in_room(id)
);

-- Fix drawings table policy
DROP POLICY IF EXISTS "Room participants can view drawings" ON public.drawings;

CREATE POLICY "Room participants can view drawings" 
ON public.drawings 
FOR SELECT 
USING (
  public.is_room_participant(room_id, auth.uid())
);

-- Fix the Only host can update room policy
DROP POLICY IF EXISTS "Only host can update room" ON public.rooms;

CREATE OR REPLACE FUNCTION public.is_room_host(p_room_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.players
    WHERE room_id = p_room_id
    AND user_id = auth.uid()
    AND is_host = true
  );
$$;

CREATE POLICY "Only host can update room" 
ON public.rooms 
FOR UPDATE 
USING (
  public.is_room_host(id)
);