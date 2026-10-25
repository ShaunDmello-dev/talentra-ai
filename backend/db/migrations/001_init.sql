
-- 001_init.sql
-- Initial schema for the AI Recruiting MVP

-- 1. Users and roles
CREATE TABLE public.users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    role TEXT NOT NULL
        CHECK (role IN ('recruiter', 'candidate', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Companies
CREATE TABLE public.companies (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    company_score NUMERIC(5, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Candidates
CREATE TABLE public.candidates (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT
        REFERENCES public.users(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    email TEXT,
    location TEXT,
    years_experience NUMERIC(4, 1),
    expected_ctc_lpa NUMERIC(8, 2),
    availability_days INTEGER,
    skills TEXT[] NOT NULL DEFAULT '{}',
    source TEXT NOT NULL DEFAULT 'synthetic',
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Jobs
CREATE TABLE public.jobs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id BIGINT
        REFERENCES public.companies(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    location TEXT,
    min_salary_lpa NUMERIC(8, 2),
    max_salary_lpa NUMERIC(8, 2),
    work_mode TEXT,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Search history
CREATE TABLE public.searches (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT
        REFERENCES public.users(id) ON DELETE SET NULL,
    search_type TEXT NOT NULL
        CHECK (search_type IN ('candidate', 'job')),
    original_query TEXT NOT NULL,
    filters JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Initial indexes for searching
CREATE INDEX idx_candidates_location
    ON public.candidates(location);

CREATE INDEX idx_candidates_experience
    ON public.candidates(years_experience);

CREATE INDEX idx_jobs_location
    ON public.jobs(location);
