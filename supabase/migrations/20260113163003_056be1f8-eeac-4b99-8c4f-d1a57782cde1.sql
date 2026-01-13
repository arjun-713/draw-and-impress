-- Create increment_player_score function for atomic score updates
CREATE OR REPLACE FUNCTION public.increment_player_score(
  p_player_id UUID,
  p_points INTEGER
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.players
  SET score = score + p_points
  WHERE id = p_player_id;
END;
$$;

-- Create trigger to auto-update vote_count when votes are inserted
CREATE OR REPLACE FUNCTION public.update_drawing_vote_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.drawings
  SET vote_count = vote_count + 1
  WHERE id = NEW.drawing_id;
  RETURN NEW;
END;
$$;

-- Create trigger on votes table
DROP TRIGGER IF EXISTS on_vote_insert ON public.votes;
CREATE TRIGGER on_vote_insert
AFTER INSERT ON public.votes
FOR EACH ROW
EXECUTE FUNCTION public.update_drawing_vote_count();