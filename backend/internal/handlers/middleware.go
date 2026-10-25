
package handlers

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type contextKey string

const (
	userIDKey contextKey = "userID"
	userRoleKey contextKey = "userRole"
)

func RequireAuth(db *pgxpool.Pool, allowedRoles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			cookie, err := r.Cookie("talentra_session")
			if err != nil || cookie.Value == "" {
				http.Error(w, "Authentication required", http.StatusUnauthorized)
				return
			}

			tokenHash := sha256.Sum256([]byte(cookie.Value))
			hashedToken := hex.EncodeToString(tokenHash[:])

			ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
			defer cancel()

			var userID int64
			var role string

			err = db.QueryRow(ctx, `
				SELECT u.id, u.role
				FROM public.sessions s
				JOIN public.users u ON u.id = s.user_id
				WHERE s.token_hash = $1
				  AND s.expires_at > NOW()
			`, hashedToken).Scan(&userID, &role)

			if err != nil {
				http.Error(w, "Invalid or expired session", http.StatusUnauthorized)
				return
			}

			if len(allowedRoles) > 0 {
				roleAllowed := false
				for _, allowedRole := range allowedRoles {
					if role == allowedRole {
						roleAllowed = true
						break
					}
				}

				if !roleAllowed {
					http.Error(w, "Forbidden: insufficient permissions", http.StatusForbidden)
					return
				}
			}

			ctxWithUser := context.WithValue(r.Context(), userIDKey, userID)
			ctxWithUser = context.WithValue(ctxWithUser, userRoleKey, role)

			next.ServeHTTP(w, r.WithContext(ctxWithUser))
		})
	}
}
