
package handlers

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
    DB           *pgxpool.Pool
    CookieSecure bool
}

type registerRequest struct {
	FullName        string   `json:"fullName"`
	Email           string   `json:"email"`
	Password        string   `json:"password"`
	Role            string   `json:"role"`
	CompanyName     string   `json:"companyName"`
	Location        string   `json:"location"`
	YearsExperience float64  `json:"yearsExperience"`
	ExpectedCTCLPA  float64  `json:"expectedCtcLpa"`
	AvailabilityDays int     `json:"availabilityDays"`
	Skills          []string `json:"skills"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type registerResponse struct {
	Message string `json:"message"`
	User    struct {
		ID        int64  `json:"id"`
		FullName  string `json:"fullName"`
		Email     string `json:"email"`
		Role      string `json:"role"`
		CompanyID *int64 `json:"companyId,omitempty"`
	} `json:"user"`
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	defer r.Body.Close()

	var req registerRequest
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()

	if err := decoder.Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	req.FullName = strings.TrimSpace(req.FullName)
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.Role = strings.ToLower(strings.TrimSpace(req.Role))
	req.CompanyName = strings.TrimSpace(req.CompanyName)

	if req.FullName == "" || len(req.FullName) > 120 {
		http.Error(w, "Please provide a valid full name", http.StatusBadRequest)
		return
	}

	if len(req.Email) > 254 || !strings.Contains(req.Email, "@") {
		http.Error(w, "Please provide a valid email address", http.StatusBadRequest)
		return
	}

	if len(req.Password) < 8 || len(req.Password) > 72 {
		http.Error(w, "Password must be between 8 and 72 bytes", http.StatusBadRequest)
		return
	}

	if req.Role != "recruiter" && req.Role != "candidate" {
		http.Error(w, "Invalid account type", http.StatusBadRequest)
		return
	}

	if req.Role == "recruiter" &&
		(req.CompanyName == "" || len(req.CompanyName) > 160) {
		http.Error(w, "Please provide a valid company name", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	passwordHash, err := bcrypt.GenerateFromPassword(
		[]byte(req.Password),
		bcrypt.DefaultCost,
	)
	if err != nil {
		http.Error(w, "Unable to create account", http.StatusInternalServerError)
		return
	}

	tx, err := h.DB.Begin(ctx)
	if err != nil {
		http.Error(w, "Unable to create account", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	var userID int64
	err = tx.QueryRow(ctx, `
		INSERT INTO public.users (full_name, email, password_hash, role)
		VALUES ($1, $2, $3, $4)
		RETURNING id
	`, req.FullName, req.Email, string(passwordHash), req.Role).Scan(&userID)

	if err != nil {
		if isUniqueViolation(err) {
			http.Error(w, "Unable to register with these details", http.StatusConflict)
			return
		}
		http.Error(w, "Unable to create account", http.StatusInternalServerError)
		return
	}

	// Create the candidate profile in the same transaction as the user.
if req.Role == "candidate" {
    _, err = tx.Exec(ctx, `
        INSERT INTO public.candidates (
            user_id,
            full_name,
            email,
            location,
            years_experience,
            expected_ctc_lpa,
            availability_days,
            skills,
            source
        )
        VALUES (
            $1, $2, $3,
            NULLIF($4, ''),
            NULLIF($5, 0),
            NULLIF($6, 0),
            NULLIF($7, 0),
            $8,
            'candidate_registration'
        )
    `,
        userID,
        req.FullName,
        req.Email,
        strings.TrimSpace(req.Location),
        req.YearsExperience,
        req.ExpectedCTCLPA,
        req.AvailabilityDays,
        req.Skills,
    )

    if err != nil {
        http.Error(w, "Unable to create account", http.StatusInternalServerError)
        return
    }
}

	var companyID *int64
	if req.Role == "recruiter" {
		var id int64
		err = tx.QueryRow(ctx, `
			INSERT INTO public.companies (name)
			VALUES ($1)
			RETURNING id
		`, req.CompanyName).Scan(&id)

		if err != nil {
			http.Error(w, "Unable to create account", http.StatusInternalServerError)
			return
		}
		companyID = &id
	}

	if err := tx.Commit(ctx); err != nil {
		http.Error(w, "Unable to create account", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)

	response := registerResponse{Message: "Account created successfully"}
	response.User.ID = userID
	response.User.FullName = req.FullName
	response.User.Email = req.Email
	response.User.Role = req.Role
	response.User.CompanyID = companyID

	_ = json.NewEncoder(w).Encode(response)
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	defer r.Body.Close()

	var req loginRequest
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()

	if err := decoder.Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	if req.Email == "" || req.Password == "" {
		http.Error(w, "Email and password are required", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	var user struct {
		ID           int64
		FullName     string
		Email        string
		PasswordHash string
		Role         string
	}

	err := h.DB.QueryRow(ctx, `
		SELECT id, COALESCE(full_name, ''), email, password_hash, role
		FROM public.users
		WHERE email = $1
	`, req.Email).Scan(
		&user.ID,
		&user.FullName,
		&user.Email,
		&user.PasswordHash,
		&user.Role,
	)

	if err != nil || bcrypt.CompareHashAndPassword(
		[]byte(user.PasswordHash),
		[]byte(req.Password),
	) != nil {
		http.Error(w, "Invalid email or password", http.StatusUnauthorized)
		return
	}

	// Generate a cryptographically secure session token.
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		http.Error(w, "Unable to create session", http.StatusInternalServerError)
		return
	}

	token := hex.EncodeToString(tokenBytes)

	// Store only the SHA-256 hash of the session token.
	tokenHash := sha256.Sum256([]byte(token))
	hashedToken := hex.EncodeToString(tokenHash[:])

	expiresAt := time.Now().Add(7 * 24 * time.Hour)

	_, err = h.DB.Exec(ctx, `
		INSERT INTO public.sessions (user_id, token_hash, expires_at)
		VALUES ($1, $2, $3)
	`, user.ID, hashedToken, expiresAt)

	if err != nil {
		http.Error(w, "Unable to create session", http.StatusInternalServerError)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "talentra_session",
		Value:    token,
		Path:     "/",
		HttpOnly: true,
Secure:   h.CookieSecure,		SameSite: http.SameSiteLaxMode,
		Expires:  expiresAt,
		MaxAge:   int((7 * 24 * time.Hour).Seconds()),
	})

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Login successful",
		"user": map[string]interface{}{
			"id":       user.ID,
			"fullName": user.FullName,
			"email":    user.Email,
			"role":     user.Role,
		},
	})
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	cookie, err := r.Cookie("talentra_session")
	if err != nil || cookie.Value == "" {
		http.Error(w, "Authentication required", http.StatusUnauthorized)
		return
	}

	tokenHash := sha256.Sum256([]byte(cookie.Value))
	hashedToken := hex.EncodeToString(tokenHash[:])

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	var user struct {
		ID       int64  `json:"id"`
		FullName string `json:"fullName"`
		Email    string `json:"email"`
		Role     string `json:"role"`
	}

	err = h.DB.QueryRow(ctx, `
		SELECT u.id, COALESCE(u.full_name, ''), u.email, u.role
		FROM public.sessions s
		JOIN public.users u ON u.id = s.user_id
		WHERE s.token_hash = $1
		  AND s.expires_at > NOW()
	`, hashedToken).Scan(
		&user.ID,
		&user.FullName,
		&user.Email,
		&user.Role,
	)

	if err != nil {
		http.Error(w, "Invalid or expired session", http.StatusUnauthorized)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"user": user,
	})
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	cookie, err := r.Cookie("talentra_session")
	if err == nil && cookie.Value != "" {
		tokenHash := sha256.Sum256([]byte(cookie.Value))
		hashedToken := hex.EncodeToString(tokenHash[:])

		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		_, err := h.DB.Exec(ctx, `
			DELETE FROM public.sessions
			WHERE token_hash = $1
		`, hashedToken)

		if err != nil {
			http.Error(w, "Unable to end session", http.StatusInternalServerError)
			return
		}
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "talentra_session",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
Secure:   h.CookieSecure,		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
		Expires:  time.Unix(0, 0),
	})

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{
		"message": "Logged out successfully",
	})
}
