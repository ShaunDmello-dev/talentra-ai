package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type JobSearchHandler struct {
	DB *pgxpool.Pool
}

type JobResult struct {
	ID           int64    `json:"id"`
	CompanyID    *int64   `json:"company_id"`
	Title        string   `json:"title"`
	CompanyName  *string  `json:"company_name"`
	Location     *string  `json:"location"`
	MinSalaryLPA *float64 `json:"min_salary_lpa"`
	MaxSalaryLPA *float64 `json:"max_salary_lpa"`
	WorkMode     *string  `json:"work_mode"`
	Description  *string  `json:"description"`
}

func (h *JobSearchHandler) Search(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	query := r.URL.Query()

	title := strings.TrimSpace(query.Get("title"))
	location := strings.TrimSpace(query.Get("location"))
	workMode := strings.ToLower(strings.TrimSpace(query.Get("work_mode")))
	skills := strings.TrimSpace(query.Get("skills"))

	var minExperience *int
	if raw := query.Get("min_experience"); raw != "" {
		value, err := strconv.Atoi(raw)
		if err != nil || value < 0 || value > 80 {
			http.Error(w, "Invalid minimum experience", http.StatusBadRequest)
			return
		}
		minExperience = &value
	}

	if len(title) > 150 || len(location) > 100 || len(workMode) > 20 || len(skills) > 1000 {
		http.Error(w, "Search filter is too long", http.StatusBadRequest)
		return
	}

	if workMode != "" &&
		workMode != "remote" &&
		workMode != "hybrid" &&
		workMode != "onsite" {
		http.Error(w, "Invalid work mode", http.StatusBadRequest)
		return
	}

	var minSalary *float64
	if raw := query.Get("min_salary_lpa"); raw != "" {
		value, err := strconv.ParseFloat(raw, 64)
		if err != nil || value < 0 || value > 100000 {
			http.Error(w, "Invalid minimum salary", http.StatusBadRequest)
			return
		}
		minSalary = &value
	}

	limit := 20
	if raw := query.Get("limit"); raw != "" {
		value, err := strconv.Atoi(raw)
		if err != nil || value < 1 || value > 50 {
			http.Error(w, "Limit must be between 1 and 50", http.StatusBadRequest)
			return
		}
		limit = value
	}

	rows, err := h.DB.Query(ctx, `
    SELECT
        j.id,
        j.company_id,
        j.title,
        c.name AS company_name,
        j.location,
        j.min_salary_lpa,
        j.max_salary_lpa,
        j.work_mode,
        j.description
    FROM public.jobs j
    LEFT JOIN public.companies c ON c.id = j.company_id
    WHERE
(
    $1 = ''
    OR NOT EXISTS (
        SELECT 1
        FROM regexp_split_to_table(
            regexp_replace(LOWER($1), '[^a-z0-9]+', ' ', 'g'),
            '\s+'
        ) AS query_word
        WHERE query_word <> ''
          AND query_word NOT IN (
              'find', 'me', 'a', 'an', 'the', 'for',
              'job', 'jobs', 'role', 'roles', 'position', 'positions'
          )
          AND NOT EXISTS (
              SELECT 1
              FROM regexp_split_to_table(
                  regexp_replace(LOWER(j.title), '[^a-z0-9]+', ' ', 'g'),
                  '\s+'
              ) AS title_word
              WHERE
                  title_word = regexp_replace(query_word, 's$', '')
                  OR title_word = query_word
          )
    )
)
        AND ($2 = '' OR COALESCE(j.location, '') ILIKE '%' || $2 || '%')
        AND ($3::float8 IS NULL OR j.max_salary_lpa >= $3)
        AND ($4 = '' OR LOWER(COALESCE(j.work_mode, '')) = $4)
        AND (
            $5::text[] IS NULL
            OR cardinality($5::text[]) = 0
            OR NOT EXISTS (
                SELECT 1
                FROM unnest($5::text[]) AS requested_skill
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM unnest(j.required_skills) AS job_skill
                    WHERE LOWER(job_skill) = LOWER(requested_skill)
                )
            )
        )
        AND ($6::int IS NULL OR j.min_experience >= $6)
    ORDER BY j.created_at DESC, j.id DESC
    LIMIT $7
`,
		title,
		location,
		minSalary,
		workMode,
		func() []string {
			if skills == "" {
				return nil
			}
			parts := strings.Split(skills, ",")
			cleaned := make([]string, 0, len(parts))
			for _, part := range parts {
				part = strings.TrimSpace(part)
				if part != "" {
					cleaned = append(cleaned, part)
				}
			}
			return cleaned
		}(),
		minExperience,
		limit,
	)

	if err != nil {
		http.Error(w, "Unable to search jobs", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	jobs := make([]JobResult, 0)

	for rows.Next() {
		var job JobResult

		err := rows.Scan(
			&job.ID,
			&job.CompanyID,
			&job.Title,
			&job.CompanyName,
			&job.Location,
			&job.MinSalaryLPA,
			&job.MaxSalaryLPA,
			&job.WorkMode,
			&job.Description,
		)
		if err != nil {
			http.Error(w, "Unable to read job results", http.StatusInternalServerError)
			return
		}

		jobs = append(jobs, job)
	}

	if err := rows.Err(); err != nil {
		http.Error(w, "Unable to read job results", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	if err := json.NewEncoder(w).Encode(map[string]interface{}{
		"jobs":  jobs,
		"count": len(jobs),
	}); err != nil {
		return
	}
}
