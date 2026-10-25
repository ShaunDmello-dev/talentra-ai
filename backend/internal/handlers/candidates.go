package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type CandidateSearchHandler struct {
	DB *pgxpool.Pool
}

type CandidateResult struct {
	ID               int64    `json:"id"`
	FullName         string   `json:"full_name"`
	Email            string   `json:"email"`
	Location         string   `json:"location"`
	YearsExperience  int      `json:"years_experience"`
	CandidateScore   *int     `json:"candidate_score"`
	ExpectedCTCLPA   *float64 `json:"expected_ctc_lpa"`
	AvailabilityDays *int     `json:"availability_days"`
	Skills           []string `json:"skills"`
	Source           string   `json:"source"`
}

func (h *CandidateSearchHandler) Search(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()

	// Read optional filters.
	location := strings.TrimSpace(query.Get("location"))

	var locationFilter *string
	if location != "" {
		locationFilter = &location
	}

	var skillsFilter []string
	if rawSkills := strings.TrimSpace(query.Get("skills")); rawSkills != "" {
		for _, skill := range strings.Split(rawSkills, ",") {
			skill = strings.TrimSpace(skill)
			if skill != "" {
				skillsFilter = append(skillsFilter, skill)
			}
		}
	}

	var minExperience *int
	if raw := query.Get("min_experience"); raw != "" {
		value, err := strconv.Atoi(raw)
		if err != nil || value < 0 || value > 80 {
			http.Error(w, "min_experience must be between 0 and 80", http.StatusBadRequest)
			return
		}
		minExperience = &value
	}
	var minCandidateScore *int
	if raw := query.Get("min_candidate_score"); raw != "" {
		value, err := strconv.Atoi(raw)
		if err != nil || value < 80 || value > 100 {
			http.Error(
				w,
				"min_candidate_score must be between 80 and 100",
				http.StatusBadRequest,
			)
			return
		}
		minCandidateScore = &value
	}

	var maxCTC *float64
	if raw := query.Get("max_ctc_lpa"); raw != "" {
		value, err := strconv.ParseFloat(raw, 64)
		if err != nil || value < 0 || value > 100000 {
			http.Error(w, "max_ctc_lpa must be a valid non-negative amount", http.StatusBadRequest)
			return
		}
		maxCTC = &value
	}

	var availableWithin *int
	if raw := query.Get("available_within_days"); raw != "" {
		value, err := strconv.Atoi(raw)
		if err != nil || value < 0 || value > 3650 {
			http.Error(w, "available_within_days must be between 0 and 3650", http.StatusBadRequest)
			return
		}
		availableWithin = &value
	}

	// Default to 10 results; never return more than 50.
	limit := 10
	if raw := query.Get("limit"); raw != "" {
		value, err := strconv.Atoi(raw)
		if err != nil || value < 1 || value > 50 {
			http.Error(w, "limit must be between 1 and 50", http.StatusBadRequest)
			return
		}
		limit = value
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	rows, err := h.DB.Query(ctx, `
		SELECT
			id,
			full_name,
			email,
			location,
			years_experience,
			candidate_score,
			expected_ctc_lpa,
			availability_days,
			COALESCE(skills, ARRAY[]::text[]),
			COALESCE(source, 'unknown')
		FROM public.candidates
		WHERE ($1::text IS NULL OR location ILIKE '%' || $1 || '%')
					AND (
					COALESCE(array_length($2::text[], 1), 0) = 0
					OR NOT EXISTS (
						SELECT 1
						FROM unnest($2::text[]) AS requested_skill
						WHERE NOT EXISTS (
							SELECT 1
							FROM unnest(COALESCE(skills, ARRAY[]::text[])) AS candidate_skill
							WHERE LOWER(candidate_skill) = LOWER(requested_skill)
						)
					)
				)
		  AND ($3::int IS NULL OR years_experience >= $3)
		  AND ($4::int IS NULL OR candidate_score >= $4)
		  AND ($5::numeric IS NULL OR expected_ctc_lpa <= $5)
		  AND ($6::int IS NULL OR availability_days <= $6)
		ORDER BY years_experience DESC, full_name ASC
		LIMIT $7
	`,
		locationFilter,
		skillsFilter,
		minExperience,
		minCandidateScore,
		maxCTC,
		availableWithin,
		limit,
	)
	if err != nil {
		log.Printf("Candidate search query failed: %v", err)
		http.Error(w, "Unable to search candidates", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	candidates := make([]CandidateResult, 0)

	for rows.Next() {
		var candidate CandidateResult

		err := rows.Scan(
			&candidate.ID,
			&candidate.FullName,
			&candidate.Email,
			&candidate.Location,
			&candidate.YearsExperience,
			&candidate.CandidateScore,
			&candidate.ExpectedCTCLPA,
			&candidate.AvailabilityDays,
			&candidate.Skills,
			&candidate.Source,
		)
		if err != nil {
			http.Error(w, "Unable to read candidate results", http.StatusInternalServerError)
			return
		}

		candidates = append(candidates, candidate)
	}

	if err := rows.Err(); err != nil {
		http.Error(w, "Unable to read candidate results", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"count":      len(candidates),
		"candidates": candidates,
	})
}
