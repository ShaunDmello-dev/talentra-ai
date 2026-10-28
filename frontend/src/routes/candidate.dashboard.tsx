
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BriefcaseBusiness,
  Building2,
  Bookmark,
  UserRound,
  Search,
  Sparkles,
  MapPin,
  ArrowUpRight,
  Mic,
} from "lucide-react";
import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";

type Job = {
  id: number;
  title: string;
  company_name: string | null;
  location: string | null;
  min_salary_lpa: number | null;
  max_salary_lpa: number | null;
  work_mode: string | null;
  description: string | null;
};

type JobSearchFilters = {
  title: string;
  location: string;
  min_salary_lpa: number;
  work_mode: string;
  skills: string[];
  min_experience: number;
};

type SavedJob = Job & {
  saved_at?: string;
};



function parseJobSearchWithRegex(query: string): JobSearchFilters {
  const text = query.trim();

  const salaryMatch = text.match(
    /\b(?:at least|minimum|min(?:imum)? salary(?: of)?|paying(?: at least)?|above|over)?\s*₹?\s*(\d+(?:\.\d+)?)\s*(?:lpa|lakhs?|lac)\b/i,
  );

  const experienceMatch = text.match(
    /\b(\d+)\s*\+?\s*(?:years?|yrs?)(?:\s+of)?(?:\s+experience|\s+exp)?\b/i,
  );

  const locationMatch = text.match(
    /\b(?:in|based in|located in)\s+([a-z]+(?:[\s,]+[a-z]+){0,2}?)(?=\s+(?:paying|with|who|having|at least|for|remote|hybrid|onsite|on-site)\b|[,.;]|$)/i,
  );

  const location = locationMatch?.[1]?.trim() ?? "";

  let workMode = "";
  if (/\bremote\b/i.test(text)) {
    workMode = "remote";
  } else if (/\bhybrid\b/i.test(text)) {
    workMode = "hybrid";
  } else if (/\b(on[- ]?site|in[- ]office)\b/i.test(text)) {
    workMode = "onsite";
  }

  const knownSkills = [
    "machine learning",
    "data engineering",
    "javascript",
    "typescript",
    "postgresql",
    "mongodb",
    "kubernetes",
    "node.js",
    "nodejs",
    "react",
    "python",
    "golang",
    "java",
    "docker",
    "figma",
    "ui/ux",
    "sql",
    "go",
  ];

  const skills = knownSkills
    .filter((skill) => {
      const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(text);
    })
    .map((skill) =>
      skill === "nodejs" ? "Node.js" : skill === "go" ? "Go" : skill,
    );

  let title = text
    .replace(/\b(find|search for|search|show me|show|get me|please|looking for|look for)\b/gi, " ")
    .replace(/\b(?:in|based in|located in)\s+[a-z]+(?:[\s,]+[a-z]+){0,2}(?=\s+(?:paying|with|who|having|at least|for|remote|hybrid|onsite|on-site)\b|[,.;]|$)/gi, " ")
    .replace(/\b(?:paying|earning)\b.*$/i, " ")
    .replace(/\b(?:at least|minimum|min(?:imum)? salary(?: of)?|above|over)\b/gi, " ")
    .replace(/₹?\s*\d+(?:\.\d+)?\s*(?:lpa|lakhs?|lac)\b/gi, " ")
    .replace(/\b\d+\s*\+?\s*(?:years?|yrs?)(?:\s+of)?(?:\s+experience|\s+exp)?\b/gi, " ")
    .replace(/\b(?:remote|hybrid|onsite|on[- ]?site|in[- ]office)\b/gi, " ")
    .replace(/\b(?:jobs?|opportunities|positions|roles)\b/gi, " ")
    .replace(/[,.!?]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Keep the title useful when the query is mostly filters.
  if (!title) {
    title = skills.join(" ");
  }

  return {
    title,
    location,
    min_salary_lpa: salaryMatch ? Number(salaryMatch[1]) : 0,
    work_mode: workMode,
    skills,
    min_experience: experienceMatch ? Number(experienceMatch[1]) : 0,
  };
}



export const Route = createFileRoute("/candidate/dashboard")({
  component: CandidateDashboard,
});

function CandidateDashboard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [showCompanies, setShowCompanies] = useState(false);
  const [companies, setCompanies] = useState<
    {
      id: number;
      name: string;
      companyScore: number | null;
      jobs: {
        id: number;
        title: string;
        location: string | null;
        workMode: string | null;
        minSalaryLpa: number | null;
        maxSalaryLpa: number | null;
      }[];
    }[]
  >([]);
  const [companySearch, setCompanySearch] = useState("");
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [companiesError, setCompaniesError] = useState("");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [savedJobIds, setSavedJobIds] = useState<number[]>([]);
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const [showSavedJobs, setShowSavedJobs] = useState(false);
  const [search, setSearch] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");

  const [profile, setProfile] = useState({
    fullName: "",
    email: "",
    location: "",
    yearsExperience: 0,
    expectedCtcLpa: 0,
    availabilityDays: 0,
    skills: [] as string[],
  });

  const [profileSkills, setProfileSkills] = useState("");

  const loadProfile = async () => {
  setProfileLoading(true);
  setProfileMessage("");

  try {
    const response = await fetch(
  `${import.meta.env.VITE_API_URL}/api/v1/candidate/profile`,
  { credentials: "include" },
);
    if (!response.ok) {
      throw new Error("Failed to load profile.");
    }

    const data = await response.json();

    setProfile({
      fullName: data.fullName ?? "",
      email: data.email ?? "",
      location: data.location ?? "",
      yearsExperience: data.yearsExperience ?? 0,
      expectedCtcLpa: data.expectedCtcLpa ?? 0,
      availabilityDays: data.availabilityDays ?? 0,
      skills: data.skills ?? [],
    });

    setProfileSkills((data.skills ?? []).join(", "));
  } catch (error) {
    setProfileMessage(
      error instanceof Error ? error.message : "Could not load profile.",
    );
  } finally {
    setProfileLoading(false);
  }
};

const saveProfile = async () => {
  setProfileSaving(true);
  setProfileMessage("");

  const updatedProfile = {
    ...profile,
    skills: profileSkills
      .split(",")
      .map((skill) => skill.trim())
      .filter(Boolean),
  };

  try {
   const response = await fetch(
  `${import.meta.env.VITE_API_URL}/api/v1/candidate/profile`,
  {
    method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatedProfile),
      },
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || "Failed to save profile.");
    }

    setProfile(updatedProfile);
    setProfileMessage("Profile updated successfully!");
  } catch (error) {
    setProfileMessage(
      error instanceof Error ? error.message : "Could not save profile.",
    );
  } finally {
    setProfileSaving(false);
  }
};

const loadCompanies = async (searchTerm = "") => {
  setCompaniesLoading(true);
  setCompaniesError("");

  try {
    const params = new URLSearchParams();
    if (searchTerm.trim()) {
      params.set("q", searchTerm.trim());
    }

    const response = await fetch(
  `${import.meta.env.VITE_API_URL}/api/v1/candidate/companies?${params.toString()}`,
  { credentials: "include" },
);
    if (!response.ok) {
      throw new Error("Failed to load companies.");
    }

    const data = await response.json();
    setCompanies(data);
  } catch (error) {
    setCompaniesError(
      error instanceof Error ? error.message : "Could not load companies.",
    );
  } finally {
    setCompaniesLoading(false);
  }
};

function startVoiceSearch() {
  const SpeechRecognitionAPI = (
    window as Window & {
      SpeechRecognition?: new () => {
        lang: string;
        continuous: boolean;
        interimResults: boolean;
        onresult: ((event: {
          results: { [index: number]: { [index: number]: { transcript: string } } } & { length: number };
        }) => void) | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
        start: () => void;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        continuous: boolean;
        interimResults: boolean;
        onresult: ((event: {
          results: { [index: number]: { [index: number]: { transcript: string } } } & { length: number };
        }) => void) | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
        start: () => void;
      };
    }
  ).SpeechRecognition || (
    window as Window & {
      webkitSpeechRecognition?: new () => {
        lang: string;
        continuous: boolean;
        interimResults: boolean;
        onresult: ((event: {
          results: { [index: number]: { [index: number]: { transcript: string } } } & { length: number };
        }) => void) | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
        start: () => void;
      };
    }
  ).webkitSpeechRecognition;

  if (!SpeechRecognitionAPI) {
    setError("Voice search isn't supported in this browser. Try Chrome.");
    return;
  }

  const recognition = new SpeechRecognitionAPI();
  recognition.lang = "en-IN";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    setSearch(transcript);
    setError("");
    setNotice("Voice search captured. Click Search to find matching jobs.");
  };

  recognition.onerror = () => {
    setError("Couldn't capture your voice. Please allow microphone access and try again.");
    setIsListening(false);
  };

  recognition.onend = () => setIsListening(false);

  setError("");
  setNotice("Listening… speak your job search now.");
  setIsListening(true);

  try {
    recognition.start();
  } catch {
    setIsListening(false);
    setError("Voice search couldn't start. Please try again.");
  }
}
  const [location, setLocation] = useState("");
  const [workMode, setWorkMode] = useState("");
  const [minSalary, setMinSalary] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [searched, setSearched] = useState(false);

  async function loadJobs(filters?: JobSearchFilters) {
    setLoading(true);
    setError("");

    const params = new URLSearchParams();
    params.set("limit", "20");

    const selectedTitle = filters?.title?.trim() ?? "";
    const selectedLocation =
      location.trim() || filters?.location?.trim() || "";
    const selectedWorkMode = workMode || filters?.work_mode || "";
    const selectedSalary =
      minSalary ||
      (filters && filters.min_salary_lpa > 0
        ? String(filters.min_salary_lpa)
        : "");

    if (selectedTitle) params.set("title", selectedTitle);
    if (selectedLocation) params.set("location", selectedLocation);
    if (selectedWorkMode) params.set("work_mode", selectedWorkMode);
    if (selectedSalary) params.set("min_salary_lpa", selectedSalary);

    if (filters?.skills?.length) {
      params.set("skills", filters.skills.join(","));
    }

    if (filters && filters.min_experience > 0) {
      params.set("min_experience", String(filters.min_experience));
    }

    try {
      const response = await fetch(
  `${import.meta.env.VITE_API_URL}/api/v1/candidate/jobs?${params.toString()}`,
  { credentials: "include" },
);

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error("Your session expired. Please sign in again.");
        }
        throw new Error("Unable to load jobs. Please try again.");
      }

      const data: { jobs?: Job[] } = await response.json();
      setJobs(data.jobs ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
    } finally {
      setLoading(false);
    }
  }



async function loadSavedJobs() {
  try {
    const response = await fetch(
  `${import.meta.env.VITE_API_URL}/api/v1/candidate/saved-jobs`,
  { credentials: "include" },
);

    if (!response.ok) {
      throw new Error("Unable to load saved jobs.");
    }

    const data: { jobs?: SavedJob[] } = await response.json();
    const loadedJobs = data.jobs ?? [];

    setSavedJobs(loadedJobs);
    setSavedJobIds(loadedJobs.map((job) => job.id));
  } catch (err) {
    console.error("Unable to load saved jobs:", err);
    setError("Unable to load your saved jobs. Please try again.");
  }
}



async function toggleSavedJob(jobId: number) {
  const isSaved = savedJobIds.includes(jobId);

  try {
    const response = await fetch(
  `${import.meta.env.VITE_API_URL}/api/v1/candidate/saved-jobs/${jobId}`,
  {
    method: isSaved ? "DELETE" : "POST",
    credentials: "include",
  },
);

    if (!response.ok) {
      throw new Error("Unable to update saved job.");
    }

    setSavedJobIds((current) =>
      isSaved
        ? current.filter((id) => id !== jobId)
        : [...current, jobId],
    );
    void loadSavedJobs();

    setError("");
    setNotice(isSaved ? "Job removed from saved jobs." : "Job saved successfully.");
  } catch {
    setError("Unable to update saved job. Please try again.");
  }
}

async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
  setSearched(true);
  setLoading(true);
  setError("");
  setNotice("");

  try {
    if (!search.trim()) {
      await loadJobs();
      return;
    }

    let filters: JobSearchFilters;

    try {
      const parseResponse = await fetch(
  `${import.meta.env.VITE_API_URL}/api/v1/candidate/parse-search`,
  {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: search.trim() }),
  },
);

      if (!parseResponse.ok) {
        throw new Error("Gemini search unavailable");
      }

      filters = await parseResponse.json();


} catch {
  filters = parseJobSearchWithRegex(search.trim());

  setNotice(
    "AI search is temporarily unavailable. We used local search instead.",
  );
}


    await loadJobs(filters);
  } catch (err) {
    setError(
      err instanceof Error ? err.message : "Something went wrong.",
    );
    setLoading(false);
  }
}



  useEffect(() => {
    void loadJobs();
    void loadSavedJobs();
  }, []);

  return (
    <div className="min-h-screen bg-[#FAF9FC] text-[#292524] md:flex">
      <aside className="border-b border-violet-100 bg-white p-5 md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0 md:border-b-0 md:border-r">
        <Link to="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#312E81] text-white shadow-sm">
            <Sparkles size={20} />
          </span>
          <span className="text-lg font-bold tracking-tight text-[#312E81]">
            Talentra <span className="font-medium">AI</span>
          </span>
        </Link>

        <p className="mb-3 mt-10 text-xs font-semibold uppercase tracking-wider text-stone-400">
          Candidate workspace
        </p>
        <button
        type="button"
        onClick={() => {
          setShowProfile(true);
          setShowSavedJobs(false);
          setSelectedJob(null);
          void loadProfile();
        }}
        className="mb-3 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-stone-500 hover:bg-violet-50 hover:text-[#7C3AED]"
      >
        <UserRound size={18} />
        My Profile
      </button>

        <nav className="space-y-1">

        <button
        type="button"
        onClick={() => {
  setShowCompanies(false);
  setShowProfile(false);
  setShowSavedJobs(false);
  setSelectedJob(null);
}}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium ${
            !showSavedJobs
            ? "bg-violet-50 text-[#312E81]"
            : "text-stone-500 hover:bg-stone-50 hover:text-[#7C3AED]"
        }`}
        >
        <BriefcaseBusiness size={18} />
        Overview
        </button>


        <button
        type="button"
        onClick={() => {
        setShowCompanies(true);
        setShowProfile(false);
        setShowSavedJobs(false);
        setSelectedJob(null);
        void loadCompanies();
      }}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium ${
          showCompanies
            ? "bg-violet-50 text-[#312E81]"
            : "text-stone-500 hover:bg-stone-50 hover:text-[#7C3AED]"
        }`}
      >
        <Building2 size={18} />
        Find companies
      </button>

        <button
        type="button"
        onClick={() => {
  setShowSavedJobs(true);
  setShowCompanies(false);
  setShowProfile(false);
  setSelectedJob(null);
}}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium ${
            showSavedJobs
            ? "bg-violet-50 text-[#312E81]"
            : "text-stone-500 hover:bg-stone-50 hover:text-[#7C3AED]"
        }`}
        >
        <Bookmark size={18} />
        Saved jobs
        </button>



        </nav>

<button
  type="button"
  onClick={async () => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/v1/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      window.location.href = "/";
    }
  }}
  className="mt-6 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-stone-600 transition hover:bg-rose-50 hover:text-rose-600"
>
  <LogOut size={18} />
  <span>Sign out</span>
</button>


        <div className="mt-10 rounded-2xl bg-[#FFF7ED] p-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#7C3AED]">
            <Sparkles size={18} />
          </span>
          <p className="mt-3 text-sm font-semibold text-[#312E81]">
            Your next chapter
          </p>
          <p className="mt-1 text-xs leading-5 text-stone-600">
            Discover opportunities that fit your skills and goals.
          </p>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-5 sm:p-8">

{showCompanies ? (
<section className="talentra-enter talentra-card mx-auto max-w-5xl space-y-6">    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <p className="text-sm font-medium text-[#7C3AED]">
          Explore employers
        </p>
        <h1 className="mt-2 text-3xl font-bold text-[#312E81]">
          Find companies
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          Discover companies and explore their available jobs.
        </p>
      </div>

      <button
        type="button"
        onClick={() => setShowCompanies(false)}
        className="rounded-xl border border-stone-200 px-4 py-2 text-sm hover:bg-stone-50"
      >
        Back to jobs
      </button>
    </div>

    <form
      onSubmit={(event) => {
        event.preventDefault();
        void loadCompanies(companySearch);
      }}
      className="flex flex-col gap-3 rounded-2xl border border-violet-100 bg-white p-4 shadow-sm sm:flex-row"
    >
      <input
        type="text"
        value={companySearch}
        onChange={(event) => setCompanySearch(event.target.value)}
        placeholder="Search by company name..."
        className="min-w-0 flex-1 rounded-xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
      />

      <button
        type="submit"
        disabled={companiesLoading}
        className="rounded-xl bg-[#7C3AED] px-5 py-3 text-sm font-semibold text-white hover:bg-[#6D28D9] disabled:opacity-60"
      >
        {companiesLoading ? "Searching..." : "Search companies"}
      </button>
    </form>

    {companiesError && (
      <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
        {companiesError}
      </p>
    )}

    {companiesLoading ? (
      <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-500">
        Loading companies...
      </div>
    ) : companies.length === 0 ? (
      <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
        <Building2 className="mx-auto text-violet-500" size={32} />
        <h2 className="mt-3 font-semibold text-[#312E81]">
          No companies found
        </h2>
        <p className="mt-1 text-sm text-stone-500">
          Try another company name or clear your search.
        </p>
      </div>
    ) : (
      <div className="grid gap-5 lg:grid-cols-2">
        {companies.map((company) => (
          <article
            key={company.id}
            className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-[#7C3AED]">
                <Building2 size={22} />
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="break-words text-lg font-semibold text-[#312E81]">
                  {company.name}
                </h2>
                <p className="mt-1 text-sm text-stone-500">
                  {company.companyScore !== null
                    ? `Company score: ${company.companyScore}`
                    : "Company score not available"}
                </p>
              </div>
            </div>

            <div className="mt-5 border-t border-stone-100 pt-4">
              <h3 className="font-semibold text-stone-800">
                Available jobs ({company.jobs.length})
              </h3>

              {company.jobs.length === 0 ? (
                <p className="mt-2 text-sm text-stone-500">
                  No jobs are currently listed for this company.
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  {company.jobs.map((job) => (
                    <div
                      key={job.id}
                      className="rounded-xl bg-stone-50 p-3"
                    >
                      <h4 className="font-medium text-stone-800">
                        {job.title}
                      </h4>

                      <p className="mt-1 text-sm text-stone-500">
                        {job.location || "Location not specified"}
                        {" · "}
                        {job.workMode || "Work mode not specified"}
                      </p>

                      <p className="mt-2 text-sm font-medium text-[#7C3AED]">
                        {job.minSalaryLpa != null ||
                        job.maxSalaryLpa != null
                          ? `₹${job.minSalaryLpa ?? "—"}–${job.maxSalaryLpa ?? "—"} LPA`
                          : "Salary not specified"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    )}
  </section>
) : showProfile ? (

  <section className="mx-auto max-w-3xl rounded-2xl border border-violet-100 bg-white p-6 shadow-sm sm:p-8">
    <div className="mb-6 flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-[#312E81]">My Profile</h1>
        <p className="mt-1 text-sm text-stone-500">
          Keep your professional details up to date.
        </p>
      </div>
      <button
        type="button"
        onClick={() => setShowProfile(false)}
        className="rounded-xl border border-stone-200 px-4 py-2 text-sm hover:bg-stone-50"
      >
        Back to jobs
      </button>
    </div>

    {profileLoading ? (
      <p className="py-6 text-sm text-stone-500">Loading profile...</p>
    ) : (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void saveProfile();
        }}
        className="space-y-5"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block text-sm font-medium text-stone-700">
            Full name
            <input
              required
              value={profile.fullName}
              onChange={(event) =>
                setProfile({ ...profile, fullName: event.target.value })
              }
              className="mt-2 w-full rounded-xl border border-stone-200 px-3 py-2.5"
            />
          </label>

          <label className="block text-sm font-medium text-stone-700">
            Email
            <input
              type="email"
              value={profile.email}
              readOnly
              className="mt-2 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5"
            />
          </label>

          <label className="block text-sm font-medium text-stone-700">
            Location
            <input
              required
              value={profile.location}
              onChange={(event) =>
                setProfile({ ...profile, location: event.target.value })
              }
              placeholder="e.g. Mumbai"
              className="mt-2 w-full rounded-xl border border-stone-200 px-3 py-2.5"
            />
          </label>

          <label className="block text-sm font-medium text-stone-700">
            Years of experience
            <input
              type="number"
              min="0"
              step="0.5"
              value={profile.yearsExperience}
              onChange={(event) =>
                setProfile({
                  ...profile,
                  yearsExperience: Number(event.target.value),
                })
              }
              className="mt-2 w-full rounded-xl border border-stone-200 px-3 py-2.5"
            />
          </label>

          <label className="block text-sm font-medium text-stone-700">
            Expected CTC (LPA)
            <input
              type="number"
              min="0"
              step="0.5"
              value={profile.expectedCtcLpa}
              onChange={(event) =>
                setProfile({
                  ...profile,
                  expectedCtcLpa: Number(event.target.value),
                })
              }
              className="mt-2 w-full rounded-xl border border-stone-200 px-3 py-2.5"
            />
          </label>

          <label className="block text-sm font-medium text-stone-700">
            Availability (days)
            <input
              type="number"
              min="0"
              value={profile.availabilityDays}
              onChange={(event) =>
                setProfile({
                  ...profile,
                  availabilityDays: Number(event.target.value),
                })
              }
              className="mt-2 w-full rounded-xl border border-stone-200 px-3 py-2.5"
            />
          </label>
        </div>

        <label className="block text-sm font-medium text-stone-700">
          Skills
          <input
            value={profileSkills}
            onChange={(event) => setProfileSkills(event.target.value)}
            placeholder="React, Go, PostgreSQL"
            className="mt-2 w-full rounded-xl border border-stone-200 px-3 py-2.5"
          />
          <span className="mt-1 block text-xs text-stone-500">
            Separate skills with commas.
          </span>
        </label>

        {profileMessage && (
          <p className="text-sm text-stone-600" role="status">
            {profileMessage}
          </p>
        )}

        <button
          type="submit"
          disabled={profileSaving || profileLoading}
          className="rounded-xl bg-[#312E81] px-5 py-3 text-sm font-semibold text-white hover:bg-[#4338CA] disabled:opacity-50"
        >
          {profileSaving ? "Saving..." : "Save profile"}
        </button>
      </form>
    )}
  </section>
) : (
  <>
    <header className="mb-8">
          <p className="text-sm font-medium text-[#7C3AED]">
            Candidate workspace
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#312E81]">
            Find your next opportunity
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">
            Describe your ideal job in plain English, and let AI find matching
            opportunities.
          </p>
        </header>

        <section className="talentra-enter talentra-card mb-8 rounded-2xl border border-violet-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-[#7C3AED]">
              <Sparkles size={20} />
            </span>
            <div>
              <h2 className="font-semibold text-[#312E81]">
                AI job search
              </h2>
              <p className="text-xs text-stone-500">
                Tell us what kind of role you're looking for.
              </p>
            </div>
          </div>

          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-stone-200 px-3 focus-within:border-violet-400">
                <Search size={18} className="shrink-0 text-stone-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="e.g. Remote React jobs in Mumbai paying 15 LPA"
                  aria-label="Describe your ideal job"
                  className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none"
                />
                <button
                type="button"
                title={isListening ? "Listening..." : "Search using your voice"}
                aria-label="Search using your voice"
                onClick={startVoiceSearch}
                className={`rounded-lg p-2 ${
                    isListening
                    ? "bg-violet-100 text-violet-700"
                    : "text-stone-500 hover:bg-violet-50"
                }`}
                >
                <Mic size={18} />
                </button>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4338CA] px-5 py-3 text-sm font-semibold text-white hover:bg-[#312E81] disabled:opacity-60"
              >
                <Search size={16} />
                {loading && searched ? "Searching..." : "Search jobs"}
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs font-medium text-stone-600">
                Location
                <span className="mt-1.5 flex items-center gap-2 rounded-xl border border-stone-200 px-3">
                  <MapPin size={16} className="text-stone-400" />
                  <input
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    placeholder="Any location"
                    className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none"
                  />
                </span>
              </label>

              <label className="text-xs font-medium text-stone-600">
                Work mode
                <select
                  value={workMode}
                  onChange={(event) => setWorkMode(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-400"
                >
                  <option value="">Any work mode</option>
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="onsite">On-site</option>
                </select>
              </label>

              <label className="text-xs font-medium text-stone-600">
                Minimum salary (LPA)
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={minSalary}
                  onChange={(event) => setMinSalary(event.target.value)}
                  placeholder="e.g. 12"
                  className="mt-1.5 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm outline-none focus:border-violet-400"
                />
              </label>
            </div>

            <p className="text-xs text-stone-400">
              Tip: include a role, skills, location, work mode, and salary in
              your request for better matches.
            </p>
          </form>
        </section>

<section className="talentra-enter talentra-enter-delay-1">          <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <h2 className="text-xl font-bold text-[#312E81]">
                {showSavedJobs
                ? "Saved jobs"
                : searched
                    ? "Search results"
                    : "Available opportunities"}
              </h2>
              <p className="mt-1 text-sm text-stone-500">
                {loading
                  ? "Loading jobs..."
                  : `${jobs.length} ${jobs.length === 1 ? "job" : "jobs"} found`}
              </p>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}
          {notice && (
            <div
                role="status"
                className="mb-4 rounded-xl border border-violet-100 bg-violet-50 p-3 text-sm text-violet-800"
            >
                {notice}
            </div>
            )}

          {!loading && !error && jobs.length === 0 && (
            <div className="rounded-2xl border border-dashed border-violet-200 bg-white p-10 text-center">
              <Search className="mx-auto text-violet-400" size={28} />
              <h3 className="mt-3 font-semibold text-[#312E81]">
                No matching jobs found
              </h3>
              <p className="mt-1 text-sm text-stone-500">
                Try broadening your search or adjusting your filters.
              </p>
            </div>
          )}

          {selectedJob ? (
<div className="talentra-enter talentra-card rounded-2xl border border-violet-100 bg-white p-6 shadow-sm">    <button
      type="button"
      onClick={() => setSelectedJob(null)}
      className="mb-6 text-sm font-semibold text-[#7C3AED] hover:text-[#312E81]"
    >
      ← Back to jobs
    </button>

    <div className="mb-5">
      <p className="mb-2 text-sm font-medium text-violet-600">
        Job details
      </p>
      <h3 className="text-2xl font-bold text-[#312E81]">
        {selectedJob.title}
      </h3>
      <p className="mt-2 flex items-center gap-2 text-stone-600">
        <Building2 size={16} />
        {selectedJob.company_name || "Company not specified"}
      </p>
      <p className="mt-2 flex items-center gap-2 text-stone-600">
        <MapPin size={16} />
        {selectedJob.location || "Location not specified"}
      </p>
    </div>

    <div className="mb-6 grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl bg-violet-50 p-4">
        <p className="text-sm text-stone-500">Salary range</p>
        <p className="mt-1 font-semibold text-[#312E81]">
          {selectedJob.min_salary_lpa != null ||
          selectedJob.max_salary_lpa != null
            ? `${selectedJob.min_salary_lpa ?? "—"}–${selectedJob.max_salary_lpa ?? "—"} LPA`
            : "Not specified"}
        </p>
      </div>

      <div className="rounded-xl bg-violet-50 p-4">
        <p className="text-sm text-stone-500">Work mode</p>
        <p className="mt-1 font-semibold capitalize text-[#312E81]">
          {selectedJob.work_mode || "Not specified"}
        </p>
      </div>
    </div>

    <div>
      <h4 className="mb-2 font-semibold text-[#312E81]">
        Job description
      </h4>
      <p className="whitespace-pre-wrap text-sm leading-7 text-stone-600">
        {selectedJob.description || "No job description is available yet."}
      </p>
    </div>

    <button
      type="button"
      onClick={() => void toggleSavedJob(selectedJob.id)}
      className="mt-6 rounded-xl bg-[#7C3AED] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#312E81]"
    >
      {savedJobIds.includes(selectedJob.id)
        ? "Remove from saved jobs"
        : "Save this job"}
    </button>
  </div>
) : (
  <div className="grid gap-4 xl:grid-cols-2">
            {(showSavedJobs ? savedJobs : jobs).map((job) => (
              <article
                key={job.id}
className="talentra-enter talentra-card rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm transition hover:border-violet-200"              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-[#7C3AED]">
                      <BriefcaseBusiness size={20} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-[#312E81]">
                        {job.title}
                      </h3>
                      <p className="mt-1 text-sm text-stone-500">
                        {job.company_name || "Company not listed"}
                      </p>
                    </div>
                  </div>

                <button
                type="button"
                title={
                    savedJobIds.includes(job.id)
                    ? "Remove saved job"
                    : "Save job"
                }
                aria-label={
                    savedJobIds.includes(job.id)
                    ? `Remove ${job.title} from saved jobs`
                    : `Save ${job.title}`
                }
                aria-pressed={savedJobIds.includes(job.id)}
                onClick={() => void toggleSavedJob(job.id)}
                className={`rounded-lg p-2 transition hover:bg-violet-50 ${
                    savedJobIds.includes(job.id)
                    ? "text-[#7C3AED]"
                    : "text-stone-400 hover:text-[#7C3AED]"
                }`}
                >
                <Bookmark
                    size={18}
                    fill={savedJobIds.includes(job.id) ? "currentColor" : "none"}
                />
                </button>

                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-stone-600">
                  {job.location && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-stone-50 px-2.5 py-1.5">
                      <MapPin size={13} />
                      {job.location}
                    </span>
                  )}
                  {job.work_mode && (
                    <span className="rounded-full bg-violet-50 px-2.5 py-1.5 text-violet-800">
                      {job.work_mode}
                    </span>
                  )}
                  {(job.min_salary_lpa != null ||
                    job.max_salary_lpa != null) && (
                    <span className="rounded-full bg-orange-50 px-2.5 py-1.5 text-orange-800">
                      {job.min_salary_lpa ?? "—"}–{job.max_salary_lpa ?? "—"} LPA
                    </span>
                  )}
                </div>

                {job.description && (
                  <p className="mt-4 line-clamp-3 text-sm leading-6 text-stone-600">
                    {job.description}
                  </p>
                )}

                <div className="mt-5 flex justify-end border-t border-stone-100 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                    setSelectedJob(job);
                    setError("");
                    setNotice("");
                    }}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-[#7C3AED] hover:text-[#312E81]"
                  >
                    View details <ArrowUpRight size={16} />
                  </button>
                </div>
              </article>
                        ))}
          </div>
          )}
        </section>
         </>
        )}
      </main>
    </div>
  );
}
