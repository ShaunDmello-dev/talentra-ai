
package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

type CandidateProfileHandler struct {
	DB *pgxpool.Pool
}

type CandidateProfile struct {
	FullName        string   `json:"fullName"`
	Email           string   `json:"email"`
	Location        string   `json:"location"`
	YearsExperience *float64 `json:"yearsExperience"`
	ExpectedCTCLPA  *float64 `json:"expectedCtcLpa"`
	AvailabilityDays *int    `json:"availabilityDays"`
	Skills          []string `json:"skills"`
}

func (h *CandidateProfileHandler) Get(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(userIDKey).(int64)
	if !ok {
		http.Error(w, "Authentication required", http.StatusUnauthorized)
		return
	}

	var profile CandidateProfile
	err := h.DB.QueryRow(r.Context(), `
		SELECT
			u.full_name,
			u.email,
			COALESCE(c.location, ''),
			c.years_experience,
			c.expected_ctc_lpa,
			c.availability_days,
			COALESCE(c.skills, ARRAY[]::text[])
		FROM public.users u
		JOIN public.candidates c ON c.user_id = u.id
		WHERE u.id = $1
	`, userID).Scan(
		&profile.FullName,
		&profile.Email,
		&profile.Location,
		&profile.YearsExperience,
		&profile.ExpectedCTCLPA,
		&profile.AvailabilityDays,
		&profile.Skills,
	)
	if err != nil {
		http.Error(w, "Unable to load candidate profile", http.StatusInternalServerError)
		return
	}

	if profile.Skills == nil {
		profile.Skills = []string{}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(profile)
}

func (h *CandidateProfileHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(userIDKey).(int64)
	if !ok {
		http.Error(w, "Authentication required", http.StatusUnauthorized)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	defer r.Body.Close()

	var profile CandidateProfile
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()

	if err := decoder.Decode(&profile); err != nil {
		http.Error(w, "Invalid profile data", http.StatusBadRequest)
		return
	}

	profile.FullName = strings.TrimSpace(profile.FullName)
	profile.Location = strings.TrimSpace(profile.Location)

	if profile.FullName == "" || len(profile.FullName) > 120 {
		http.Error(w, "Please provide a valid full name", http.StatusBadRequest)
		return
	}
	if len(profile.Location) > 120 {
		http.Error(w, "Location is too long", http.StatusBadRequest)
		return
	}
	if profile.YearsExperience != nil &&
		(*profile.YearsExperience < 0 || *profile.YearsExperience > 60) {
		http.Error(w, "Experience must be between 0 and 60 years", http.StatusBadRequest)
		return
	}
	if profile.ExpectedCTCLPA != nil &&
		(*profile.ExpectedCTCLPA < 0 || *profile.ExpectedCTCLPA > 1000) {
		http.Error(w, "Expected CTC must be between 0 and 1000 LPA", http.StatusBadRequest)
		return
	}
	if profile.AvailabilityDays != nil &&
		(*profile.AvailabilityDays < 0 || *profile.AvailabilityDays > 365) {
		http.Error(w, "Availability must be between 0 and 365 days", http.StatusBadRequest)
		return
	}
	if len(profile.Skills) > 50 {
		http.Error(w, "Too many skills", http.StatusBadRequest)
		return
	}
	for i, skill := range profile.Skills {
		profile.Skills[i] = strings.TrimSpace(skill)
		if profile.Skills[i] == "" || len(profile.Skills[i]) > 80 {
			http.Error(w, "Please check the skill names", http.StatusBadRequest)
			return
		}
	}

	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		http.Error(w, "Unable to update profile", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(r.Context())

	_, err = tx.Exec(r.Context(), `
		UPDATE public.users
		SET full_name = $1
		WHERE id = $2 AND role = 'candidate'
	`, profile.FullName, userID)
	if err != nil {
		http.Error(w, "Unable to update profile", http.StatusInternalServerError)
		return
	}

	result, err := tx.Exec(r.Context(), `
		UPDATE public.candidates
		SET full_name = $1,
		    location = NULLIF($2, ''),
		    years_experience = $3,
		    expected_ctc_lpa = $4,
		    availability_days = $5,
		    skills = $6
		WHERE user_id = $7
	`, profile.FullName, profile.Location,
		profile.YearsExperience, profile.ExpectedCTCLPA,
		profile.AvailabilityDays, profile.Skills, userID)
	if err != nil || result.RowsAffected() == 0 {
		http.Error(w, "Unable to update candidate profile", http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		http.Error(w, "Unable to update profile", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{
		"message": "Profile updated successfully",
	})
}
