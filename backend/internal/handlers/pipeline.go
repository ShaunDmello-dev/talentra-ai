
package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

type PipelineHandler struct {
	DB *pgxpool.Pool
}

type PipelineItem struct {
	ID              int64  `json:"id"`
	CandidateID     int64  `json:"candidate_id"`
	FullName        string `json:"full_name"`
	Email           string `json:"email"`
	Location        string `json:"location"`
	Stage           string `json:"stage"`
	LastContactedAt any    `json:"last_contacted_at"`
}

type UpdatePipelineRequest struct {
	CandidateID int64  `json:"candidate_id"`
	Stage       string `json:"stage"`
}

var validPipelineStages = map[string]bool{
	"discovered":  true,
	"contacted":   true,
	"spoken":      true,
	"negotiating": true,
}

func (h *PipelineHandler) List(w http.ResponseWriter, r *http.Request) {
	recruiterID, ok := r.Context().Value(userIDKey).(int64)
	if !ok || recruiterID <= 0 {
		http.Error(w, "Authentication required", http.StatusUnauthorized)
		return
	}

	rows, err := h.DB.Query(r.Context(), `
		SELECT rp.id, c.id, c.full_name,
		       COALESCE(c.email, ''),
		       COALESCE(c.location, ''),
		       rp.stage, rp.last_contacted_at
		FROM public.recruitment_pipeline rp
		JOIN public.candidates c ON c.id = rp.candidate_id
		WHERE rp.recruiter_id = $1
		ORDER BY rp.updated_at DESC, rp.id DESC
	`, recruiterID)
	if err != nil {
		http.Error(w, "Unable to load recruitment pipeline", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	items := make([]PipelineItem, 0)
	for rows.Next() {
		var item PipelineItem
		if err := rows.Scan(
			&item.ID, &item.CandidateID, &item.FullName,
			&item.Email, &item.Location, &item.Stage,
			&item.LastContactedAt,
		); err != nil {
			http.Error(w, "Unable to read recruitment pipeline", http.StatusInternalServerError)
			return
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		http.Error(w, "Unable to read recruitment pipeline", http.StatusInternalServerError)
		return
	}

	writePipelineJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *PipelineHandler) Update(w http.ResponseWriter, r *http.Request) {
	recruiterID, ok := r.Context().Value(userIDKey).(int64)
	if !ok || recruiterID <= 0 {
		http.Error(w, "Authentication required", http.StatusUnauthorized)
		return
	}

	var req UpdatePipelineRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	req.Stage = strings.ToLower(strings.TrimSpace(req.Stage))
	if req.CandidateID <= 0 || !validPipelineStages[req.Stage] {
		http.Error(w, "A valid candidate_id and stage are required", http.StatusBadRequest)
		return
	}

	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO public.recruitment_pipeline
			(recruiter_id, candidate_id, stage, last_contacted_at, updated_at)
		VALUES (
			$1, $2, $3,
			CASE WHEN $3 = 'contacted' THEN NOW() ELSE NULL END,
			NOW()
		)
		ON CONFLICT (recruiter_id, candidate_id)
		DO UPDATE SET
			stage = EXCLUDED.stage,
			last_contacted_at = CASE
				WHEN EXCLUDED.stage = 'contacted'
					THEN COALESCE(public.recruitment_pipeline.last_contacted_at, NOW())
				ELSE public.recruitment_pipeline.last_contacted_at
			END,
			updated_at = NOW()
	`, recruiterID, req.CandidateID, req.Stage)
	if err != nil {
		http.Error(w, "Unable to update candidate stage", http.StatusInternalServerError)
		return
	}

	writePipelineJSON(w, http.StatusOK, map[string]string{
		"message": "Pipeline stage updated",
		"stage":   req.Stage,
	})
}

func writePipelineJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}


type DiscoverCandidatesRequest struct {
	CandidateIDs []int64 `json:"candidate_ids"`
}

func (h *PipelineHandler) Discover(w http.ResponseWriter, r *http.Request) {
	recruiterID, ok := r.Context().Value(userIDKey).(int64)
	if !ok || recruiterID <= 0 {
		http.Error(w, "Authentication required", http.StatusUnauthorized)
		return
	}

	var req DiscoverCandidatesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if len(req.CandidateIDs) == 0 {
		writePipelineJSON(w, http.StatusOK, map[string]string{
			"message": "No candidates to add",
		})
		return
	}

	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		http.Error(w, "Unable to start pipeline update", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(r.Context())

	for _, candidateID := range req.CandidateIDs {
		if candidateID <= 0 {
			http.Error(w, "Invalid candidate ID", http.StatusBadRequest)
			return
		}

		_, err := tx.Exec(r.Context(), `
			INSERT INTO public.recruitment_pipeline
				(recruiter_id, candidate_id, stage)
			SELECT $1, c.id, 'discovered'
			FROM public.candidates c
			WHERE c.id = $2
			ON CONFLICT (recruiter_id, candidate_id) DO NOTHING
		`, recruiterID, candidateID)
		if err != nil {
			http.Error(w, "Unable to save discovered candidates", http.StatusInternalServerError)
			return
		}
	}

	if err := tx.Commit(r.Context()); err != nil {
		http.Error(w, "Unable to save discovered candidates", http.StatusInternalServerError)
		return
	}

	writePipelineJSON(w, http.StatusOK, map[string]string{
		"message": "Candidates added to pipeline",
	})
}
