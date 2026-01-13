-- Rooms table for game sessions
CREATE TABLE public.rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  host_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'drawing', 'gallery', 'voting', 'results', 'finished')),
  current_round INTEGER NOT NULL DEFAULT 0,
  total_rounds INTEGER NOT NULL DEFAULT 3,
  draw_time INTEGER NOT NULL DEFAULT 60,
  vote_time INTEGER NOT NULL DEFAULT 30,
  max_players INTEGER NOT NULL DEFAULT 8,
  current_prompt TEXT,
  phase_end_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Players table for game participants
CREATE TABLE public.players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  username TEXT NOT NULL,
  avatar_color TEXT NOT NULL DEFAULT '#FF6B6B',
  score INTEGER NOT NULL DEFAULT 0,
  is_host BOOLEAN NOT NULL DEFAULT false,
  is_ready BOOLEAN NOT NULL DEFAULT false,
  is_connected BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Drawings table for submitted artwork
CREATE TABLE public.drawings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  image_data TEXT NOT NULL,
  vote_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Votes table for tracking player votes
CREATE TABLE public.votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  drawing_id UUID NOT NULL REFERENCES public.drawings(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(voter_id, round)
);

-- Prompts table for game prompts
CREATE TABLE public.prompts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  text TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  is_custom BOOLEAN NOT NULL DEFAULT false
);

-- Enable RLS on all tables
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drawings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;

-- RLS policies for rooms (public game, no auth required)
CREATE POLICY "Anyone can view rooms" ON public.rooms FOR SELECT USING (true);
CREATE POLICY "Anyone can create rooms" ON public.rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update rooms" ON public.rooms FOR UPDATE USING (true);

-- RLS policies for players
CREATE POLICY "Anyone can view players" ON public.players FOR SELECT USING (true);
CREATE POLICY "Anyone can join as player" ON public.players FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update players" ON public.players FOR UPDATE USING (true);
CREATE POLICY "Anyone can leave room" ON public.players FOR DELETE USING (true);

-- RLS policies for drawings
CREATE POLICY "Anyone can view drawings" ON public.drawings FOR SELECT USING (true);
CREATE POLICY "Anyone can submit drawings" ON public.drawings FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update drawings" ON public.drawings FOR UPDATE USING (true);

-- RLS policies for votes
CREATE POLICY "Anyone can view votes" ON public.votes FOR SELECT USING (true);
CREATE POLICY "Anyone can cast votes" ON public.votes FOR INSERT WITH CHECK (true);

-- RLS policies for prompts
CREATE POLICY "Anyone can view prompts" ON public.prompts FOR SELECT USING (true);
CREATE POLICY "Anyone can add custom prompts" ON public.prompts FOR INSERT WITH CHECK (true);

-- Enable realtime for rooms and players
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.drawings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.votes;

-- Seed some default prompts
INSERT INTO public.prompts (text, category) VALUES
  ('A cat wearing a top hat', 'animals'),
  ('Your dream vacation', 'abstract'),
  ('A robot making breakfast', 'funny'),
  ('The last thing you ate', 'food'),
  ('Your favorite superhero', 'pop culture'),
  ('A house on the moon', 'fantasy'),
  ('The best day ever', 'abstract'),
  ('A dragon playing video games', 'fantasy'),
  ('Your morning routine', 'daily life'),
  ('A chef cooking pizza', 'food'),
  ('An alien visiting Earth', 'sci-fi'),
  ('Your happy place', 'abstract'),
  ('A penguin at the beach', 'animals'),
  ('The future of transportation', 'sci-fi'),
  ('Your childhood pet', 'animals'),
  ('A magical forest', 'fantasy'),
  ('The best invention ever', 'abstract'),
  ('A monster under the bed', 'funny'),
  ('Your dream job', 'abstract'),
  ('A fish out of water', 'funny');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for rooms updated_at
CREATE TRIGGER update_rooms_updated_at
  BEFORE UPDATE ON public.rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();