
-- Add optional assessment score for candidate profiles.
-- NULL means the candidate has not been assessed.
ALTER TABLE public.candidates
ADD COLUMN candidate_score INTEGER;

-- Restrict populated scores to the assignment's 80–100 range.
ALTER TABLE public.candidates
ADD CONSTRAINT candidates_candidate_score_range
CHECK (
    candidate_score IS NULL
    OR candidate_score BETWEEN 80 AND 100
);
