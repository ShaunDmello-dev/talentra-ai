package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type GitHubSourcingHandler struct {
	Client *http.Client
}

type GitHubSearchResponse struct {
	TotalCount int `json:"total_count"`
	Items      []struct {
		Login     string `json:"login"`
		HTMLURL   string `json:"html_url"`
		AvatarURL string `json:"avatar_url"`
		Type      string `json:"type"`
	} `json:"items"`
}
type GitHubUserProfile struct {
	Login     string `json:"login"`
	Name      string `json:"name"`
	HTMLURL   string `json:"html_url"`
	AvatarURL string `json:"avatar_url"`
	Bio       string `json:"bio"`
	Location  string `json:"location"`
	Company   string `json:"company"`
	Email     string `json:"email"`
	Blog      string `json:"blog"`
}
type GitHubProfile struct {
	Name      string `json:"name"`
	Login     string `json:"login"`
	HTMLURL   string `json:"html_url"`
	AvatarURL string `json:"avatar_url"`
	Bio       string `json:"bio"`
	Location  string `json:"location"`
	Company   string `json:"company"`
	Email     string `json:"email"`
	Blog      string `json:"blog"`
}

type GitHubCandidate struct {
	FullName        string `json:"full_name"`
	Username        string `json:"username"`
	Location        string `json:"location"`
	Company         string `json:"company"`
	Email           string `json:"email,omitempty"`
	Bio             string `json:"bio"`
	Skills          string `json:"skills"`
	Source          string `json:"source"`
	ProfileURL      string `json:"profile_url"`
	AvatarURL       string `json:"avatar_url"`
	SourceReference string `json:"source_reference"`
}

func NewGitHubSourcingHandler() *GitHubSourcingHandler {
	return &GitHubSourcingHandler{
		Client: &http.Client{Timeout: 8 * time.Second},
	}
}

func (h *GitHubSourcingHandler) fetchGitHubProfile(
	ctx context.Context,
	client *http.Client,
	username string,
) (*GitHubUserProfile, error) {
	apiURL := "https://api.github.com/users/" + url.PathEscape(username)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	req.Header.Set("User-Agent", "Talentra-AI-Recruiting-MVP")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("GitHub profile request returned status %d", resp.StatusCode)
	}

	var profile GitHubUserProfile
	if err := json.NewDecoder(resp.Body).Decode(&profile); err != nil {
		return nil, err
	}

	return &profile, nil
}

// Search finds public GitHub accounts using location and programming language.
func (h *GitHubSourcingHandler) Search(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	location := strings.TrimSpace(r.URL.Query().Get("location"))
	language := strings.TrimSpace(r.URL.Query().Get("language"))
	limit := 5

	if raw := r.URL.Query().Get("limit"); raw != "" {
		var requested int
		if _, err := fmt.Sscanf(raw, "%d", &requested); err == nil {
			if requested < 1 {
				requested = 1
			}
			if requested > 10 {
				requested = 10
			}
			limit = requested
		}
	}

	if location == "" && language == "" {
		http.Error(w, "Provide at least a location or programming language", http.StatusBadRequest)
		return
	}

	terms := make([]string, 0, 2)
	if location != "" {
		terms = append(terms, "location:"+location)
	}
	if language != "" {
		terms = append(terms, "language:"+language)
	}

	query := strings.Join(terms, " ")
	apiURL := "https://api.github.com/search/users?q=" + url.QueryEscape(query) +
		"&per_page=" + fmt.Sprintf("%d", limit)

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		http.Error(w, "Could not create GitHub request", http.StatusInternalServerError)
		return
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	req.Header.Set("User-Agent", "Talentra-AI-Recruiting-MVP")

	client := h.Client
	if client == nil {
		client = &http.Client{Timeout: 8 * time.Second}
	}

	resp, err := client.Do(req)
	if err != nil {
		http.Error(w, "GitHub is temporarily unavailable", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		if resp.StatusCode == http.StatusForbidden || resp.StatusCode == http.StatusTooManyRequests {
			http.Error(w, "GitHub search rate limit reached. Try again later.", http.StatusTooManyRequests)
			return
		}
		http.Error(w, "GitHub search request failed", http.StatusBadGateway)
		return
	}

	var result GitHubSearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		http.Error(w, "Could not read GitHub search results", http.StatusBadGateway)
		return
	}

	candidates := make([]GitHubCandidate, 0, len(result.Items))

	for _, item := range result.Items {
		candidate := GitHubCandidate{
			FullName:        item.Login,
			Username:        item.Login,
			Source:          "github",
			ProfileURL:      item.HTMLURL,
			AvatarURL:       item.AvatarURL,
			SourceReference: item.HTMLURL,
			Location:        "",
			Skills:          language,
		}

		profile, err := h.fetchGitHubProfile(ctx, client, item.Login)
		if err == nil {
			if strings.TrimSpace(profile.Name) != "" {
				candidate.FullName = profile.Name
			}
			candidate.Location = profile.Location
			candidate.Company = profile.Company
			candidate.Email = profile.Email
			candidate.Bio = profile.Bio

			if profile.HTMLURL != "" {
				candidate.ProfileURL = profile.HTMLURL
			}
			if profile.AvatarURL != "" {
				candidate.AvatarURL = profile.AvatarURL
			}
		}

		candidates = append(candidates, candidate)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"source":      "github",
		"query":       query,
		"total_count": result.TotalCount,
		"count":       len(candidates),
		"candidates":  candidates,
	})
}
