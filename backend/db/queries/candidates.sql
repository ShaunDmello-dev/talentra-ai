
-- name: ListCandidates :many
SELECT
    id,
    full_name,
    email,
    location,
    years_experience,
    expected_ctc_lpa,
    availability_days,
    skills
FROM public.candidates
ORDER BY id DESC
LIMIT $1;
