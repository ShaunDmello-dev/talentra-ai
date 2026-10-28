package handlers

import (
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type IngestionHandler struct {
	DB *pgxpool.Pool
}

type CandidateImport struct {
	FullName         string   `json:"fullName"`
	Email            string   `json:"email"`
	Location         string   `json:"location"`
	YearsExperience  float64  `json:"yearsExperience"`
	ExpectedCTCLPA   float64  `json:"expectedCtcLpa"`
	AvailabilityDays int      `json:"availabilityDays"`
	Skills           []string `json:"skills"`
	College          string   `json:"college"`
	GraduationYear   int      `json:"graduationYear"`
	CurrentTitle     string   `json:"currentTitle"`
	CurrentCompany   string   `json:"currentCompany"`
	LinkedInURL      string   `json:"linkedinUrl"`
	Source           string   `json:"source"`
	SourceReference  string   `json:"sourceReference"`
}

type IngestionResult struct {
	Status string `json:"status"`
	ID     int64  `json:"id,omitempty"`
}

func (h *IngestionHandler) ImportCandidate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()

	var input CandidateImport
	if err := decoder.Decode(&input); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	input.FullName = strings.TrimSpace(input.FullName)
	input.Email = strings.ToLower(strings.TrimSpace(input.Email))
	input.Location = strings.TrimSpace(input.Location)
	input.College = strings.TrimSpace(input.College)
	input.CurrentTitle = strings.TrimSpace(input.CurrentTitle)
	input.CurrentCompany = strings.TrimSpace(input.CurrentCompany)
	input.LinkedInURL = strings.TrimSpace(input.LinkedInURL)
	input.SourceReference = strings.TrimSpace(input.SourceReference)
	input.Source = strings.TrimSpace(input.Source)

	if input.FullName == "" {
		http.Error(w, "fullName is required", http.StatusBadRequest)
		return
	}
	if input.Email == "" {
		if !strings.EqualFold(input.Source, "github") {
			http.Error(w, "A valid email is required for this import source", http.StatusBadRequest)
			return
		}
	} else if !strings.Contains(input.Email, "@") {
		http.Error(w, "Invalid email address", http.StatusBadRequest)
		return
	}
	if strings.EqualFold(input.Source, "github") {
		input.SourceReference = strings.TrimSpace(input.SourceReference)

		if input.SourceReference == "" {
			input.SourceReference = strings.TrimSpace(input.LinkedInURL)
		}

		if !strings.HasPrefix(strings.ToLower(input.SourceReference), "https://github.com/") {
			http.Error(w, "A valid GitHub profile URL is required", http.StatusBadRequest)
			return
		}
	}
	if input.Source == "" {
		http.Error(w, "source is required", http.StatusBadRequest)
		return
	}
	if input.YearsExperience < 0 || input.ExpectedCTCLPA < 0 || input.AvailabilityDays < 0 {
		http.Error(w, "Experience, CTC and availability cannot be negative", http.StatusBadRequest)
		return
	}
	if input.GraduationYear < 0 || input.GraduationYear > 2100 {
		http.Error(w, "Invalid graduationYear", http.StatusBadRequest)
		return
	}
	if input.Skills == nil {
		input.Skills = []string{}
	}

	var id int64
	var err error

	if strings.EqualFold(input.Source, "github") {
		err = h.DB.QueryRow(r.Context(), `
        INSERT INTO public.candidates (
            full_name, email, location, years_experience,
            expected_ctc_lpa, availability_days, skills, source,
            college, graduation_year, current_title, current_company,
            linkedin_url, source_reference
        )
        VALUES (
            $1, NULLIF($2, ''), NULLIF($3, ''), NULLIF($4, 0),
            NULLIF($5, 0), NULLIF($6, 0), $7, $8,
            NULLIF($9, ''), NULLIF($10, 0), NULLIF($11, ''),
            NULLIF($12, ''), NULLIF($13, ''), NULLIF($14, '')
        )
        ON CONFLICT DO NOTHING
        RETURNING id
    `,
			input.FullName, input.Email, input.Location,
			input.YearsExperience, input.ExpectedCTCLPA,
			input.AvailabilityDays, input.Skills, input.Source,
			input.College, input.GraduationYear, input.CurrentTitle,
			input.CurrentCompany, input.LinkedInURL, input.SourceReference,
		).Scan(&id)
	} else {
		err = h.DB.QueryRow(r.Context(), `
        INSERT INTO public.candidates (
            full_name, email, location, years_experience,
            expected_ctc_lpa, availability_days, skills, source,
            college, graduation_year, current_title, current_company,
            linkedin_url, source_reference
        )
        VALUES (
            $1, NULLIF($2, ''), NULLIF($3, ''), NULLIF($4, 0),
            NULLIF($5, 0), NULLIF($6, 0), $7, $8,
            NULLIF($9, ''), NULLIF($10, 0), NULLIF($11, ''),
            NULLIF($12, ''), NULLIF($13, ''), NULLIF($14, '')
        )
        ON CONFLICT DO NOTHING
        RETURNING id
    `,
			input.FullName, input.Email, input.Location,
			input.YearsExperience, input.ExpectedCTCLPA,
			input.AvailabilityDays, input.Skills, input.Source,
			input.College, input.GraduationYear, input.CurrentTitle,
			input.CurrentCompany, input.LinkedInURL, input.SourceReference,
		).Scan(&id)
	}

	if errors.Is(err, pgx.ErrNoRows) {
		var existingID int64
		var lookupErr error

		if strings.EqualFold(input.Source, "github") {
			lookupErr = h.DB.QueryRow(r.Context(), `
            SELECT id
            FROM public.candidates
            WHERE LOWER(TRIM(source)) = 'github'
              AND LOWER(TRIM(source_reference)) = LOWER(TRIM($1))
            LIMIT 1
        `, input.SourceReference).Scan(&existingID)
		} else {
			lookupErr = h.DB.QueryRow(r.Context(), `
            SELECT id
            FROM public.candidates
            WHERE LOWER(TRIM(email)) = $1
            LIMIT 1
        `, input.Email).Scan(&existingID)
		}

		if lookupErr != nil {
			http.Error(w, "Failed to find duplicate candidate", http.StatusInternalServerError)
			return
		}

		_, historyErr := h.DB.Exec(r.Context(), `
        INSERT INTO public.candidate_ingestion_history
            (candidate_id, source, source_reference, outcome, details)
        VALUES ($1, $2, NULLIF($3, ''), 'duplicate', $4::jsonb)
    `, existingID, input.Source, input.SourceReference,
			`{"method":"candidate_import"}`)

		if historyErr != nil {
			http.Error(w, "Failed to record import history", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(IngestionResult{
			Status: "duplicate",
			ID:     existingID,
		})
		return
	}
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) {
			http.Error(w, "Database rejected the candidate record", http.StatusBadRequest)
			return
		}
		http.Error(w, "Failed to import candidate", http.StatusInternalServerError)
		return
	}

	_, historyErr := h.DB.Exec(r.Context(), `
    INSERT INTO public.candidate_ingestion_history
        (candidate_id, source, source_reference, outcome, details)
    VALUES ($1, $2, NULLIF($3, ''), 'created', $4::jsonb)
`, id, input.Source, input.SourceReference,
		`{"method":"candidate_import"}`)

	if historyErr != nil {
		http.Error(w, "Candidate created, but import history could not be recorded",
			http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(IngestionResult{
		Status: "created",
		ID:     id,
	})
}

type BulkImportResult struct {
	Total      int      `json:"total"`
	Created    int      `json:"created"`
	Duplicates int      `json:"duplicates"`
	Failed     int      `json:"failed"`
	Errors     []string `json:"errors,omitempty"`
}

func (h *IngestionHandler) ImportCandidatesCSV(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 5<<20)

	reader := csv.NewReader(r.Body)
	reader.TrimLeadingSpace = true

	headers, err := reader.Read()
	if err != nil {
		http.Error(w, "CSV header row is required", http.StatusBadRequest)
		return
	}
	fmt.Printf("CSV headers received: %#v\n", headers)

	for i := range headers {
		headers[i] = strings.ToLower(strings.TrimSpace(strings.TrimPrefix(headers[i], "\ufeff")))
	}

	required := []string{"fullname", "email", "location", "source"}
	index := make(map[string]int)
	for i, header := range headers {
		if _, exists := index[header]; exists {
			http.Error(w, "Duplicate CSV column: "+header, http.StatusBadRequest)
			return
		}
		index[header] = i
	}

	for _, name := range required {
		if _, exists := index[name]; !exists {
			http.Error(w, "Missing required CSV column: "+name, http.StatusBadRequest)
			return
		}
	}

	result := BulkImportResult{Errors: []string{}}

	for rowNum := 2; ; rowNum++ {
		row, readErr := reader.Read()
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("Row %d: invalid CSV row", rowNum))
			break
		}

		result.Total++

		get := func(name string) string {
			i, ok := index[name]
			if !ok || i >= len(row) {
				return ""
			}
			return strings.TrimSpace(row[i])
		}

		input := CandidateImport{
			FullName:        get("fullname"),
			Email:           strings.ToLower(get("email")),
			Location:        get("location"),
			College:         get("college"),
			CurrentTitle:    get("currenttitle"),
			CurrentCompany:  get("currentcompany"),
			LinkedInURL:     get("linkedinurl"),
			Source:          get("source"),
			SourceReference: get("sourcereference"),
		}

		if input.FullName == "" || !strings.Contains(input.Email, "@") || input.Source == "" {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("Row %d: fullName, valid email and source are required", rowNum))
			continue
		}

		if value := get("yearsexperience"); value != "" {
			input.YearsExperience, err = strconv.ParseFloat(value, 64)
			if err != nil || input.YearsExperience < 0 {
				result.Failed++
				result.Errors = append(result.Errors, fmt.Sprintf("Row %d: invalid yearsExperience", rowNum))
				continue
			}
		}

		if value := get("expectedctclpa"); value != "" {
			input.ExpectedCTCLPA, err = strconv.ParseFloat(value, 64)
			if err != nil || input.ExpectedCTCLPA < 0 {
				result.Failed++
				result.Errors = append(result.Errors, fmt.Sprintf("Row %d: invalid expectedCtcLpa", rowNum))
				continue
			}
		}

		if value := get("availabilitydays"); value != "" {
			input.AvailabilityDays, err = strconv.Atoi(value)
			if err != nil || input.AvailabilityDays < 0 {
				result.Failed++
				result.Errors = append(result.Errors, fmt.Sprintf("Row %d: invalid availabilityDays", rowNum))
				continue
			}
		}

		if value := get("graduationyear"); value != "" {
			input.GraduationYear, err = strconv.Atoi(value)
			if err != nil || input.GraduationYear < 0 || input.GraduationYear > 2100 {
				result.Failed++
				result.Errors = append(result.Errors, fmt.Sprintf("Row %d: invalid graduationYear", rowNum))
				continue
			}
		}

		if value := get("skills"); value != "" {
			for _, skill := range strings.Split(value, ";") {
				skill = strings.TrimSpace(skill)
				if skill != "" {
					input.Skills = append(input.Skills, skill)
				}
			}
		}

		// Reuse the single-record handler to preserve validation,
		// duplicate detection and provenance tracking.
		payload, _ := json.Marshal(input)
		request := r.Clone(r.Context())
		request.Method = http.MethodPost
		request.Body = io.NopCloser(strings.NewReader(string(payload)))
		request.Header = make(http.Header)
		request.Header.Set("Content-Type", "application/json")

		recorder := &responseRecorder{
			header: make(http.Header),
		}
		h.ImportCandidate(recorder, request)

		switch {
		case recorder.status == http.StatusCreated:
			result.Created++
		case recorder.status == http.StatusOK:
			var imported IngestionResult
			if json.Unmarshal([]byte(recorder.body.String()), &imported) == nil && imported.Status == "duplicate" {
				result.Duplicates++
			} else {
				result.Failed++
				result.Errors = append(result.Errors, fmt.Sprintf("Row %d: unexpected import response", rowNum))
			}
		default:
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("Row %d: import failed", rowNum))
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(result)
}

type responseRecorder struct {
	header http.Header
	body   strings.Builder
	status int
}

func (r *responseRecorder) Header() http.Header {
	return r.header
}

func (r *responseRecorder) WriteHeader(status int) {
	r.status = status
}

func (r *responseRecorder) Write(body []byte) (int, error) {
	if r.status == 0 {
		r.status = http.StatusOK
	}
	return r.body.Write(body)
}
