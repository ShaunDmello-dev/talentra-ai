package handlers

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type SavedJobsHandler struct {
	DB *pgxpool.Pool
}

func candidateIDFromRequest(
	r *http.Request,
	db *pgxpool.Pool,
) (int64, bool) {
	cookie, err := r.Cookie("talentra_session")
	if err != nil || cookie.Value == "" {
		return 0, false
	}

	tokenHash := sha256.Sum256([]byte(cookie.Value))
	hashedToken := hex.EncodeToString(tokenHash[:])

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	var candidateID int64

	err = db.QueryRow(ctx, `
        SELECT c.id
        FROM public.sessions s
        JOIN public.users u ON u.id = s.user_id
        JOIN public.candidates c ON c.user_id = u.id
        WHERE s.token_hash = $1
          AND s.expires_at > NOW()
          AND u.role = 'candidate'
    `, hashedToken).Scan(&candidateID)

	if err != nil {
		return 0, false
	}

	return candidateID, true
}

// List returns the authenticated candidate's saved jobs.
func (h *SavedJobsHandler) List(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	candidateID, ok := candidateIDFromRequest(r, h.DB)
	if !ok {
		http.Error(w, "Candidate account not found", http.StatusForbidden)
		return
	}

	rows, err := h.DB.Query(ctx, `
		SELECT
			j.id,
			j.company_id,
			j.title,
			c.name,
			j.location,
			j.min_salary_lpa,
			j.max_salary_lpa,
			j.work_mode,
			j.description,
			s.created_at
		FROM public.saved_jobs s
		JOIN public.jobs j ON j.id = s.job_id
		LEFT JOIN public.companies c ON c.id = j.company_id
		WHERE s.candidate_id = $1
		ORDER BY s.created_at DESC
	`, candidateID)
	if err != nil {
		http.Error(w, "Unable to load saved jobs", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	jobs := make([]map[string]interface{}, 0)

	for rows.Next() {
		var (
			job     JobResult
			savedAt time.Time
		)

		if err := rows.Scan(
			&job.ID,
			&job.CompanyID,
			&job.Title,
			&job.CompanyName,
			&job.Location,
			&job.MinSalaryLPA,
			&job.MaxSalaryLPA,
			&job.WorkMode,
			&job.Description,
			&savedAt,
		); err != nil {
			http.Error(w, "Unable to read saved jobs", http.StatusInternalServerError)
			return
		}

		jobs = append(jobs, map[string]interface{}{
			"id":             job.ID,
			"company_id":     job.CompanyID,
			"title":          job.Title,
			"company_name":   job.CompanyName,
			"location":       job.Location,
			"min_salary_lpa": job.MinSalaryLPA,
			"max_salary_lpa": job.MaxSalaryLPA,
			"work_mode":      job.WorkMode,
			"description":    job.Description,
			"saved_at":       savedAt,
		})
	}

	if err := rows.Err(); err != nil {
		http.Error(w, "Unable to read saved jobs", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"jobs":  jobs,
		"count": len(jobs),
	})
}

// Save adds a job to the authenticated candidate's saved list.
func (h *SavedJobsHandler) Save(w http.ResponseWriter, r *http.Request) {
	jobID, err := strconv.ParseInt(chi.URLParam(r, "jobID"), 10, 64)
	if err != nil || jobID <= 0 {
		http.Error(w, "Invalid job ID", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	candidateID, ok := candidateIDFromRequest(r, h.DB)
	if !ok {
		http.Error(w, "Candidate account not found", http.StatusForbidden)
		return
	}

	_, err = h.DB.Exec(ctx, `
		INSERT INTO public.saved_jobs (candidate_id, job_id)
		SELECT $1, j.id
		FROM public.jobs j
		WHERE j.id = $2
		ON CONFLICT (candidate_id, job_id) DO NOTHING
	`, candidateID, jobID)
	if err != nil {
		http.Error(w, "Unable to save job", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// Unsave removes a job from the authenticated candidate's saved list.
func (h *SavedJobsHandler) Unsave(w http.ResponseWriter, r *http.Request) {
	jobID, err := strconv.ParseInt(chi.URLParam(r, "jobID"), 10, 64)
	if err != nil || jobID <= 0 {
		http.Error(w, "Invalid job ID", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	candidateID, ok := candidateIDFromRequest(r, h.DB)
	if !ok {
		http.Error(w, "Candidate account not found", http.StatusForbidden)
		return
	}

	_, err = h.DB.Exec(ctx, `
		DELETE FROM public.saved_jobs
		WHERE candidate_id = $1 AND job_id = $2
	`, candidateID, jobID)
	if err != nil {
		http.Error(w, "Unable to remove saved job", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
