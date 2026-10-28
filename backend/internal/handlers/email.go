
package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/resend/resend-go/v2"
)

type EmailHandler struct {
	DB *pgxpool.Pool
}

type SendCandidateEmailRequest struct {
	CandidateID int64  `json:"candidate_id"`
	To          string `json:"to"`
	Subject     string `json:"subject"`
	Message     string `json:"message"`
}

func (h *EmailHandler) SendCandidateEmail(w http.ResponseWriter, r *http.Request) {
	var request SendCandidateEmailRequest

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	request.To = strings.TrimSpace(request.To)
	request.Subject = strings.TrimSpace(request.Subject)
	request.Message = strings.TrimSpace(request.Message)

	if request.To == "" || request.Subject == "" || request.Message == "" {
		http.Error(w, "Recipient, subject, and message are required", http.StatusBadRequest)
		return
	}

	if request.CandidateID <= 0 {
		http.Error(w, "Valid candidate ID is required", http.StatusBadRequest)
		return
	}

	if !strings.Contains(request.To, "@") {
		http.Error(w, "Invalid recipient email", http.StatusBadRequest)
		return
	}

	recruiterID, ok := r.Context().Value(userIDKey).(int64)
	if !ok || recruiterID <= 0 {
		http.Error(w, "Authentication required", http.StatusUnauthorized)
		return
	}

	apiKey := os.Getenv("RESEND_API_KEY")
	if apiKey == "" {
		http.Error(w, "Email service is not configured", http.StatusServiceUnavailable)
		return
	}

	client := resend.NewClient(apiKey)
	params := &resend.SendEmailRequest{
		From:    "Talentra AI <onboarding@resend.dev>",
		To:      []string{request.To},
		Subject: request.Subject,
		Text:    request.Message,
	}

_, err := client.Emails.Send(params)
if err != nil {
    log.Printf("Resend email failed: %v", err)
    http.Error(w, "Unable to send email. Check the backend terminal for details.", http.StatusBadGateway)
    return
}

	// Update the selected candidate's pipeline after Resend accepts the email.
	if h.DB == nil {
		log.Printf("Email sent, but database connection is unavailable")
		http.Error(w, "Email sent, but pipeline could not be updated", http.StatusInternalServerError)
		return
	}

	tag, dbErr := h.DB.Exec(r.Context(), `
		INSERT INTO public.recruitment_pipeline
			(recruiter_id, candidate_id, stage, last_contacted_at, updated_at)
		SELECT $1, c.id, 'contacted', NOW(), NOW()
		FROM public.candidates c
		WHERE c.id = $2
		ON CONFLICT (recruiter_id, candidate_id)
		DO UPDATE SET
			stage = 'contacted',
			last_contacted_at = NOW(),
			updated_at = NOW()
	`, recruiterID, request.CandidateID)

	if dbErr != nil {
		log.Printf("Email sent, but pipeline update failed: %v", dbErr)
		http.Error(w, "Email sent, but pipeline update failed", http.StatusInternalServerError)
		return
	}

	if tag.RowsAffected() == 0 {
		log.Printf("Email sent, but no candidate matched ID %d", request.CandidateID)
		http.Error(w, "Email sent, but candidate was not added to the pipeline", http.StatusInternalServerError)
		return
	}

	log.Printf("Pipeline updated to contacted for candidate ID: %d", request.CandidateID)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"message": "Email sent successfully",
	})
}
