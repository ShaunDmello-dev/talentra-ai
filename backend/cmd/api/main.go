package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"ai-recruiting-mvp/backend/internal/handlers"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

func main() {
	// Load local environment variables.
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found; using environment variables")
	}
		frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:5173"
	}
	cookieSecure := strings.EqualFold(os.Getenv("COOKIE_SECURE"), "true")

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("DATABASE_URL is required")
	}

	// Connect to PostgreSQL.
	ctx, cancel := context.WithTimeout(
		context.Background(),
		10*time.Second,
	)
	defer cancel()

	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		log.Fatalf("Unable to configure database: %v", err)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("Unable to connect to PostgreSQL: %v", err)
	}

	log.Println("Connected to PostgreSQL successfully")

	router := chi.NewRouter()

	// Development CORS: allow requests from Vite.
router.Use(func(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        origin := r.Header.Get("Origin")

        if origin == frontendURL {
            w.Header().Set("Access-Control-Allow-Origin", origin)
            w.Header().Set("Access-Control-Allow-Credentials", "true")
            w.Header().Set("Vary", "Origin")
            w.Header().Set(
                "Access-Control-Allow-Methods",
                "GET, POST, PUT, PATCH, DELETE, OPTIONS",
            )
            w.Header().Set(
                "Access-Control-Allow-Headers",
                "Content-Type, Authorization",
            )
        }

        if r.Method == http.MethodOptions {
            w.WriteHeader(http.StatusNoContent)
            return
        }

        next.ServeHTTP(w, r)
    })
})

authHandler := &handlers.AuthHandler{
    DB:           pool,
    CookieSecure: cookieSecure,
}

emailHandler := &handlers.EmailHandler{DB: pool}

	pipelineHandler := &handlers.PipelineHandler{DB: pool}

	router.Post("/api/v1/auth/register", authHandler.Register)
	router.Post("/api/v1/auth/login", authHandler.Login)
	router.Get("/api/v1/auth/me", authHandler.Me)
	router.Post("/api/v1/auth/logout", authHandler.Logout)
	candidateSearchHandler := &handlers.CandidateSearchHandler{
		DB: pool,
	}
	githubSourcingHandler := handlers.NewGitHubSourcingHandler()
	jobSearchHandler := &handlers.JobSearchHandler{
		DB: pool,
	}
	companyHandler := &handlers.CompanyHandler{DB: pool}
	ingestionHandler := &handlers.IngestionHandler{DB: pool}
	nlpHandler := &handlers.NLPHandler{}

	router.With(handlers.RequireAuth(pool, "recruiter")).
		Get("/api/v1/recruiter/candidates", candidateSearchHandler.Search)
	router.With(handlers.RequireAuth(pool, "recruiter")).
		Get("/api/v1/recruiter/candidates/github", githubSourcingHandler.Search)
	router.With(handlers.RequireAuth(pool, "recruiter")).
		Post("/api/v1/recruiter/candidates/import", ingestionHandler.ImportCandidate)
	router.With(handlers.RequireAuth(pool, "recruiter")).
		Post("/api/v1/recruiter/candidates/import-csv", ingestionHandler.ImportCandidatesCSV)
	router.With(handlers.RequireAuth(pool, "recruiter")).
		Post("/api/v1/recruiter/parse-search", nlpHandler.ParseSearch)
	router.With(handlers.RequireAuth(pool, "recruiter")).
		Post("/api/v1/recruiter/send-email", emailHandler.SendCandidateEmail)
	router.With(handlers.RequireAuth(pool, "recruiter")).
		Get("/api/v1/recruiter/pipeline", pipelineHandler.List)
	router.With(handlers.RequireAuth(pool, "recruiter")).
		Post("/api/v1/recruiter/pipeline/discover", pipelineHandler.Discover)

	router.With(handlers.RequireAuth(pool, "recruiter")).
		Put("/api/v1/recruiter/pipeline", pipelineHandler.Update)
	router.With(handlers.RequireAuth(pool, "candidate")).
		Get("/api/v1/candidate/jobs", jobSearchHandler.Search)
	router.With(handlers.RequireAuth(pool, "candidate")).
		Get("/api/v1/candidate/companies", companyHandler.List)
	router.With(handlers.RequireAuth(pool, "candidate")).
		Post("/api/v1/candidate/parse-search", nlpHandler.ParseJobSearch)

	savedJobsHandler := &handlers.SavedJobsHandler{DB: pool}

	router.With(handlers.RequireAuth(pool, "candidate")).
		Get("/api/v1/candidate/saved-jobs", savedJobsHandler.List)

	router.With(handlers.RequireAuth(pool, "candidate")).
		Post("/api/v1/candidate/saved-jobs/{jobID}", savedJobsHandler.Save)

	router.With(handlers.RequireAuth(pool, "candidate")).
		Delete("/api/v1/candidate/saved-jobs/{jobID}", savedJobsHandler.Unsave)

	candidateProfileHandler := &handlers.CandidateProfileHandler{DB: pool}

	router.With(handlers.RequireAuth(pool, "candidate")).
		Get("/api/v1/candidate/profile", candidateProfileHandler.Get)

	router.With(handlers.RequireAuth(pool, "candidate")).
		Put("/api/v1/candidate/profile", candidateProfileHandler.Update)

	// API health check.
	router.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{
			"status": "ok",
		})
	})

	// Verify that PostgreSQL is reachable.
	router.Get("/api/v1/db-check", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()

		var result int
		if err := pool.QueryRow(ctx, "SELECT 1").Scan(&result); err != nil {
			http.Error(
				w,
				"Database check failed",
				http.StatusServiceUnavailable,
			)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{
			"status":   "connected",
			"database": "postgresql",
		})
	})

	log.Printf("API listening on http://localhost:%s", port)

	if err := http.ListenAndServe(":"+port, router); err != nil {
		log.Fatal(err)
	}
}
