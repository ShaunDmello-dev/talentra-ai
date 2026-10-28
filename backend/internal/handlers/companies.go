
package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

type CompanyHandler struct {
	DB *pgxpool.Pool
}

type Company struct {
	ID          int64    `json:"id"`
	Name        string   `json:"name"`
	CompanyScore *float64 `json:"companyScore"`
	Jobs        []CompanyJob `json:"jobs"`
}

type CompanyJob struct {
	ID           int64    `json:"id"`
	Title        string   `json:"title"`
	Location     *string  `json:"location"`
	WorkMode     *string  `json:"workMode"`
	MinSalaryLPA *float64 `json:"minSalaryLpa"`
	MaxSalaryLPA *float64 `json:"maxSalaryLpa"`
}

func (h *CompanyHandler) List(w http.ResponseWriter, r *http.Request) {
	query := strings.TrimSpace(r.URL.Query().Get("q"))

	rows, err := h.DB.Query(r.Context(), `
		SELECT id, name, company_score
		FROM public.companies
		WHERE $1 = '' OR name ILIKE '%' || $1 || '%'
		ORDER BY company_score DESC NULLS LAST, name ASC
	`, query)
	if err != nil {
		http.Error(w, "Failed to load companies", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	companies := make([]Company, 0)

	for rows.Next() {
		var company Company
		if err := rows.Scan(&company.ID, &company.Name, &company.CompanyScore); err != nil {
			http.Error(w, "Failed to read companies", http.StatusInternalServerError)
			return
		}
		company.Jobs = make([]CompanyJob, 0)
		companies = append(companies, company)
	}

	if err := rows.Err(); err != nil {
		http.Error(w, "Failed to read companies", http.StatusInternalServerError)
		return
	}

	for i := range companies {
		jobRows, err := h.DB.Query(r.Context(), `
			SELECT id, title, location, work_mode, min_salary_lpa, max_salary_lpa
			FROM public.jobs
			WHERE company_id = $1
			ORDER BY title ASC
		`, companies[i].ID)
		if err != nil {
			http.Error(w, "Failed to load company jobs", http.StatusInternalServerError)
			return
		}

		for jobRows.Next() {
			var job CompanyJob
			if err := jobRows.Scan(
				&job.ID,
				&job.Title,
				&job.Location,
				&job.WorkMode,
				&job.MinSalaryLPA,
				&job.MaxSalaryLPA,
			); err != nil {
				jobRows.Close()
				http.Error(w, "Failed to read company jobs", http.StatusInternalServerError)
				return
			}
			companies[i].Jobs = append(companies[i].Jobs, job)
		}

		if err := jobRows.Err(); err != nil {
			jobRows.Close()
			http.Error(w, "Failed to read company jobs", http.StatusInternalServerError)
			return
		}
		jobRows.Close()
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(companies); err != nil {
		return
	}
}
