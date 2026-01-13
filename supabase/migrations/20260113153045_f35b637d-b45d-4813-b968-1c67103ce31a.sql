-- Create a trigger function to update vote_count on drawings when votes are inserted
CREATE OR REPLACE FUNCTION public.update_drawing_vote_count()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Recalculate vote_count from the votes table
  UPDATE public.drawings 
  SET vote_count = (
    SELECT COUNT(*) 
    FROM public.votes 
    WHERE drawing_id = NEW.drawing_id
  )
  WHERE id = NEW.drawing_id;
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically update vote count when a vote is cast
CREATE TRIGGER trigger_update_drawing_vote_count
AFTER INSERT ON public.votes
FOR EACH ROW
EXECUTE FUNCTION public.update_drawing_vote_count();

-- Also handle vote deletion (if ever implemented)
CREATE OR REPLACE FUNCTION public.update_drawing_vote_count_on_delete()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.drawings 
  SET vote_count = (
    SELECT COUNT(*) 
    FROM public.votes 
    WHERE drawing_id = OLD.drawing_id
  )
  WHERE id = OLD.drawing_id;
  
  RETURN OLD;
END;
$$;

CREATE TRIGGER trigger_update_drawing_vote_count_on_delete
AFTER DELETE ON public.votes
FOR EACH ROW
EXECUTE FUNCTION public.update_drawing_vote_count_on_delete();

-- Add RLS policy to prevent direct vote_count updates on drawings
-- First drop the existing overly permissive UPDATE policy
DROP POLICY IF EXISTS "Anyone can update drawings" ON public.drawings;

-- Create a more restrictive policy that only allows updating specific fields (not vote_count)
-- For now, we'll prevent all updates since vote_count should only be updated by trigger
CREATE POLICY "No direct drawing updates allowed"
ON public.drawings
FOR UPDATE
USING (false)
WITH CHECK (false);