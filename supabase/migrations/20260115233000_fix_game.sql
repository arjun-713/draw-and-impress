-- Drop valid policies if they exist to reset to open access
DROP POLICY IF EXISTS "Room participants can view rooms" ON public.rooms;
DROP POLICY IF EXISTS "Anyone can view rooms" ON public.rooms;
DROP POLICY IF EXISTS "Only host can update room" ON public.rooms;
DROP POLICY IF EXISTS "Anyone can update rooms" ON public.rooms;
DROP POLICY IF EXISTS "Anyone can create rooms" ON public.rooms;

-- Re-create Open Policies for Rooms (Scribbl.io style - public)
CREATE POLICY "Public view rooms" ON public.rooms FOR SELECT USING (true);
CREATE POLICY "Public insert rooms" ON public.rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update rooms" ON public.rooms FOR UPDATE USING (true);

-- Drop valid policies for Players
DROP POLICY IF EXISTS "Room participants can view players" ON public.players;
DROP POLICY IF EXISTS "Anyone can view players" ON public.players;
DROP POLICY IF EXISTS "Anyone can join as player" ON public.players;
DROP POLICY IF EXISTS "Anyone can update players" ON public.players;
DROP POLICY IF EXISTS "Anyone can leave room" ON public.players;

-- Re-create Open Policies for Players
CREATE POLICY "Public view players" ON public.players FOR SELECT USING (true);
CREATE POLICY "Public insert players" ON public.players FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update players" ON public.players FOR UPDATE USING (true);
CREATE POLICY "Public delete players" ON public.players FOR DELETE USING (true);

-- Drop valid policies for Drawings
DROP POLICY IF EXISTS "Room participants can view drawings" ON public.drawings;
DROP POLICY IF EXISTS "Anyone can view drawings" ON public.drawings;
DROP POLICY IF EXISTS "Anyone can submit drawings" ON public.drawings;
DROP POLICY IF EXISTS "Anyone can update drawings" ON public.drawings;

-- Re-create Open Policies for Drawings
CREATE POLICY "Public view drawings" ON public.drawings FOR SELECT USING (true);
CREATE POLICY "Public insert drawings" ON public.drawings FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update drawings" ON public.drawings FOR UPDATE USING (true);

-- Modify Votes table for 5-star rating
-- First drop the unique constraint preventing multiple votes per round (we want 1 vote per drawing)
ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS votes_voter_id_round_key;
-- Also try dropping unique index if constraint name differs
DROP INDEX IF EXISTS votes_voter_id_round_key;

-- Add rating column
ALTER TABLE public.votes ADD COLUMN IF NOT EXISTS rating INTEGER DEFAULT 0 CHECK (rating >= 0 AND rating <= 5);

-- Add new unique constraint: One vote per drawing per voter
ALTER TABLE public.votes ADD CONSTRAINT votes_voter_id_drawing_key UNIQUE (voter_id, drawing_id);

-- Drop valid policies for Votes
DROP POLICY IF EXISTS "Anyone can view votes" ON public.votes;
DROP POLICY IF EXISTS "Anyone can cast votes" ON public.votes;

-- Re-create Open Policies for Votes
CREATE POLICY "Public view votes" ON public.votes FOR SELECT USING (true);
CREATE POLICY "Public insert votes" ON public.votes FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update votes" ON public.votes FOR UPDATE USING (true);

-- Create Chat Messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Open RLS for messages
CREATE POLICY "Public view messages" ON public.messages FOR SELECT USING (true);
CREATE POLICY "Public insert messages" ON public.messages FOR INSERT WITH CHECK (true);

-- Add realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
