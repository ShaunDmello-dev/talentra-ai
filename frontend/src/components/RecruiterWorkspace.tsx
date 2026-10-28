
import {
  Activity,
  BriefcaseBusiness,
  ChevronDown,
  Command,
  LayoutDashboard,
  Mail,
  Mic,
  Search,
  Sparkles,
  Target,
  Users,
  Workflow,
  LogOut,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";


const navigation = [
  { label: "Dashboard", icon: LayoutDashboard, target: "dashboard" },
  { label: "AI Candidate Search", icon: Sparkles, target: "ai-search" },
  { label: "External Sourcing", icon: Search, target: "external-sourcing" },
  { label: "Candidate Directory", icon: Users, target: "candidate-directory" },
  { label: "Recruitment Pipeline", icon: Workflow, target: "recruitment-pipeline" },
  { label: "Communications", icon: Mail, target: "communications" },
];



const metrics = [
  {
    label: "Candidates discovered",
    key: "discovered",
    note: "Demo database",
    icon: Users,
  },
  {
    label: "Candidates contacted",
    key: "contacted",
    note: "Outreach connected",
    icon: Mail,
  },
  {
    label: "Candidates spoken with",
    key: "spoken",
    note: "Activity recorded",
    icon: Activity,
  },
  {
    label: "In negotiation",
    key: "negotiating",
    note: "Pipeline records",
    icon: Target,
  },
];



const roles = [
  {
    title: "Full-Stack Engineer",
    subtitle: "Engineering · Mumbai · Hybrid",
    count: "Candidate search",
    color: "bg-violet-500",
  },
  {
    title: "Product Designer",
    subtitle: "Design · Bengaluru · Hybrid",
    count: "Job data available",
    color: "bg-sky-500",
  },
  {
    title: "Backend Engineer",
    subtitle: "Engineering · Remote-friendly",
    count: "Candidate search",
    color: "bg-emerald-500",
  },
];
type Candidate = {
  id: number;
  full_name: string;
  email: string;
  location: string;
  years_experience: number;
  candidate_score: number | null;
  expected_ctc_lpa: number | null;
  availability_days: number | null;
  skills: string[];
  source: string;
  college: string | null;
  graduation_year: number | null;
  current_title: string | null;
  current_company: string | null;
  linkedin_url: string | null;
  source_reference: string | null;
};
type GitHubCandidate = {
  full_name: string;
  username: string;
  location: string;
  company: string;
  email?: string;
  bio: string;
  skills: string;
  source: string;
  profile_url: string;
  avatar_url: string;
};

type CandidateSearchResponse = {
  count: number;
  candidates: Candidate[];
};
type RecruiterFilters = {
  location: string;
  skills: string[];
  min_experience: number;
  max_ctc_lpa: number;
  available_within_days: number;
  min_candidate_score: number;

  // Candidate enrichment filters
  college: string;
  graduation_year: number;
  current_title: string;
  current_company: string;
};

function parseRecruiterSearchWithRegex(query: string): RecruiterFilters {
  const q = query.toLowerCase();
  const filters: RecruiterFilters = {
    location: "",
    skills: [],
    min_experience: 0,
    max_ctc_lpa: 0,
    available_within_days: 0,
    min_candidate_score: 0,
    college: "",
    graduation_year: 0,
    current_title: "",
    current_company: "",
  };

  const locations = [
    "Mumbai", "Pune", "Bengaluru", "Bangalore", "Hyderabad",
    "Chennai", "Delhi", "Noida", "Gurugram", "Gurgaon",
  ];
  filters.location =
    locations.find((location) => q.includes(location.toLowerCase())) ?? "";

  const experience = q.match(
    /(?:at least|minimum|min\.?)?\s*(\d{1,2})\s*\+?\s*(?:years?|yrs?)(?:\s+of)?\s+(?:experience|exp)/i,
  );
  if (experience) filters.min_experience = Number(experience[1]);

  const ctc = q.match(
    /(?:below|under|maximum|max\.?|up to|at most|ctc\s*(?:of|under|below)?|salary\s*(?:of|under|below)?)\s*(?:₹|rs\.?\s*)?(\d+(?:\.\d+)?)\s*(?:lpa|lakhs?|l)?/i,
  );
  if (ctc) filters.max_ctc_lpa = Number(ctc[1]);

  const availability = q.match(
    /(?:within|in|available in|available within)\s*(\d{1,3})\s*days?/i,
  );
  if (availability) filters.available_within_days = Number(availability[1]);

const score = q.match(
  /(?:score|scored|rating)\s*(?:of\s+)?(?:at least|above|over|minimum|min\.?)?\s*(\d{2,3})/i,
);

if (score) {
  const value = Number(score[1]);
  if (value >= 80 && value <= 100) {
    filters.min_candidate_score = value;
  }
}

  const knownSkills = [
    "JavaScript", "TypeScript", "React", "Node.js", "Python",
    "Java", "Go", "Golang", "PHP", "MongoDB", "PostgreSQL",
    "SQL", "AWS", "Docker", "Kubernetes", "Angular", "Vue",
    "Express", "Django", "FastAPI",
  ];
  filters.skills = knownSkills.filter((skill) =>
    new RegExp(
      `(^|[^a-z0-9])${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").toLowerCase()}([^a-z0-9]|$)`,
    ).test(q),
  );

  return filters;
}
interface RecruiterWorkspaceProps {
  onLogout: () => void;
  signingOut: boolean;
}

export default function RecruiterWorkspace({
  onLogout,
  signingOut,
}: RecruiterWorkspaceProps) {
    const [activeFilters, setActiveFilters] = useState<string[]>([]);
    const [activeNavigation, setActiveNavigation] = useState("Dashboard");

function navigateToSection(target: string, label: string) {
  document.getElementById(target)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });

  setActiveNavigation(label);
}
    const [enrichmentFilters, setEnrichmentFilters] =
    useState({
      college: "",
      graduation_year: 0,
      current_title: "",
      current_company: "",
    });
    const [searchText, setSearchText] = useState(
        "Find full-stack developers with 5+ years of experience in Mumbai, available within 15 days"
    );
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [githubCandidates, setGithubCandidates] = useState<GitHubCandidate[]>([]);
    const [githubLocation, setGithubLocation] = useState("Pune");
    const [githubLanguage, setGithubLanguage] = useState("Python");
    const [githubImportStatus, setGithubImportStatus] = useState<Record<string, string>>({});
    const [githubImporting, setGithubImporting] = useState<string | null>(null);
    const [isGitHubSearching, setIsGitHubSearching] = useState(false);
    const [githubError, setGithubError] = useState("");
    const [pipelineCounts, setPipelineCounts] = useState({
  discovered: 0,
  contacted: 0,
  spoken: 0,
  negotiating: 0,
});

const [candidateStages, setCandidateStages] = useState<Record<number, string>>({});
    const [resultCount, setResultCount] = useState<number | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState("");
    const [isListening, setIsListening] = useState(false);
    const [emailCandidate, setEmailCandidate] = useState<Candidate | null>(null);
    const [emailSubject, setEmailSubject] = useState("");
    const [emailMessage, setEmailMessage] = useState("");
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const [emailStatus, setEmailStatus] = useState("");
    const [emailError, setEmailError] = useState("");
    const recognitionRef = useRef<{
  start: () => void;
  abort: () => void;
} | null>(null);

function startVoiceSearch() {
  type RecognitionResult = {
    results: ArrayLike<ArrayLike<{ transcript: string }>>;
  };
  type RecognitionInstance = {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    onresult: ((event: RecognitionResult) => void) | null;
    onerror: (() => void) | null;
    onend: (() => void) | null;
    start: () => void;
    abort: () => void;
  };
  type RecognitionConstructor = new () => RecognitionInstance;

  const browserWindow = window as Window & {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  const SpeechRecognitionAPI =
    browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;

  if (!SpeechRecognitionAPI) {
    setSearchError("Voice search isn't supported in this browser. Try Chrome.");
    return;
  }

  const recognition = new SpeechRecognitionAPI();
  recognitionRef.current = recognition;
  recognition.lang = "en-IN";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    setSearchText(transcript);
    setSearchError("");
  };

  recognition.onerror = () => {
    setSearchError("Voice capture failed. Check microphone permission and retry.");
    setIsListening(false);
  };

  recognition.onend = () => setIsListening(false);

  setSearchError("");
  setIsListening(true);

  try {
    recognition.start();
  } catch {
    setIsListening(false);
    setSearchError("Couldn't start voice search. Please try again.");
  }
}
async function importGitHubCandidate(candidate: GitHubCandidate) {
  setGithubImporting(candidate.username);
  setGithubImportStatus((previous) => ({
    ...previous,
    [candidate.username]: "",
  }));

  try {
    const response = await fetch(
      "http://localhost:8080/api/v1/recruiter/candidates/import",
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          fullName: candidate.full_name || candidate.username,
          email: candidate.email || "",
          location: candidate.location || "",
          yearsExperience: 0,
          expectedCtcLpa: 0,
          availabilityDays: 0,
          skills: candidate.skills ? [candidate.skills] : [],
          college: "",
          graduationYear: 0,
          currentTitle: "",
          currentCompany: candidate.company || "",
          linkedinUrl: "",
          source: "github",
          sourceReference: candidate.profile_url,
        }),
      },
    );

    const data: { status?: string; error?: string } = await response
      .json()
      .catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `Import failed (${response.status}).`);
    }

    setGithubImportStatus((previous) => ({
      ...previous,
      [candidate.username]:
        data.status === "duplicate"
          ? "Already exists in Talentra."
          : "Imported successfully!",
    }));
  } catch (error) {
    setGithubImportStatus((previous) => ({
      ...previous,
      [candidate.username]:
        error instanceof Error ? error.message : "Import failed.",
    }));
  } finally {
    setGithubImporting(null);
  }
}
async function searchGitHubCandidates() {
  setIsGitHubSearching(true);
  setGithubError("");
  setGithubCandidates([]);

  try {
    const params = new URLSearchParams();
    params.set("limit", "5");

    if (githubLocation.trim()) {
      params.set("location", githubLocation.trim());
    }

    if (githubLanguage.trim()) {
      params.set("language", githubLanguage.trim());
    }

    if (!githubLocation.trim() && !githubLanguage.trim()) {
      setGithubError("Enter a location or programming language.");
      return;
    }

    const response = await fetch(
      `http://localhost:8080/api/v1/recruiter/candidates/github?${params.toString()}`,
      {
        credentials: "include",
        headers: { Accept: "application/json" },
      },
    );

    if (!response.ok) {
      throw new Error(
        response.status === 429
          ? "GitHub search limit reached. Try again later."
          : "Unable to search GitHub profiles.",
      );
    }

    const data: { candidates?: GitHubCandidate[] } =
      await response.json();

    setGithubCandidates(data.candidates ?? []);
  } catch (error) {
    setGithubError(
      error instanceof Error
        ? error.message
        : "GitHub search failed. Please try again.",
    );
  } finally {
    setIsGitHubSearching(false);
  }
}

async function handleSearch() {
  setIsSearching(true);
  setSearchError("");
  setCandidates([]);
  setResultCount(null);
  setActiveFilters([]);

  try {
    let filters: RecruiterFilters;

try {
  const parseResponse = await fetch(
    "http://localhost:8080/api/v1/recruiter/parse-search",
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query: searchText.trim() }),
    },
  );

  if (parseResponse.status === 401 || parseResponse.status === 403) {
    throw new Error(
      "Your recruiter session is no longer valid. Please sign in again.",
    );
  }

  if (!parseResponse.ok) {
    throw new Error("Gemini parser unavailable");
  }

  filters = await parseResponse.json();
} catch (error) {
  if (
    error instanceof Error &&
    error.message.includes("session is no longer valid")
  ) {
    throw error;
  }

  filters = parseRecruiterSearchWithRegex(searchText.trim());
  setActiveFilters(["⚠ Gemini unavailable — local regex fallback used"]);
  setSearchError(
    "AI parsing is temporarily unavailable. Search continued using local parsing.",
  );
  }
    filters = {
  ...filters,
  college: enrichmentFilters.college.trim() || filters.college || "",
  graduation_year:
    enrichmentFilters.graduation_year || filters.graduation_year || 0,
  current_title:
    enrichmentFilters.current_title.trim() || filters.current_title || "",
  current_company:
    enrichmentFilters.current_company.trim() || filters.current_company || "",
};
    // 2. Show the filters returned by Gemini.
    const visibleFilters: string[] = [];

    if (filters.location) {
      visibleFilters.push(`Location: ${filters.location}`);
    }

    if ((filters.skills ?? []).length > 0) {
      visibleFilters.push(`Skills: ${filters.skills.join(", ")}`);
    }

    if (filters.min_experience > 0) {
      visibleFilters.push(
        `Experience: ${filters.min_experience}+ years`
      );
    }

    if (filters.max_ctc_lpa > 0) {
      visibleFilters.push(`Maximum CTC: ₹${filters.max_ctc_lpa} LPA`);
    }

    if (filters.available_within_days > 0) {
      visibleFilters.push(
        `Available within ${filters.available_within_days} days`
      );
    }
    if (filters.min_candidate_score > 0) {
      visibleFilters.push(
        `Minimum Candidate Score: ${filters.min_candidate_score}`
      );
    }
    if (enrichmentFilters.college.trim()) {
  filters.college = enrichmentFilters.college.trim();
}

if (enrichmentFilters.graduation_year > 0) {
  filters.graduation_year = enrichmentFilters.graduation_year;
}

if (enrichmentFilters.current_title.trim()) {
  filters.current_title = enrichmentFilters.current_title.trim();
}

if (enrichmentFilters.current_company.trim()) {
  filters.current_company = enrichmentFilters.current_company.trim();
}
    setActiveFilters(visibleFilters);

    // 3. Send Gemini's filters to the existing candidate-search API.
    const params = new URLSearchParams();

    if (filters.location) {
      params.set("location", filters.location);
    }

    if ((filters.skills ?? []).length > 0) {
      params.set("skills", (filters.skills ?? []).join(","));
    }

    if (filters.min_experience > 0) {
      params.set("min_experience", String(filters.min_experience));
    }

    if (filters.max_ctc_lpa > 0) {
      params.set("max_ctc_lpa", String(filters.max_ctc_lpa));
    }

    if (filters.college?.trim()) {
  params.set("college", filters.college.trim());
}

if (filters.graduation_year > 0) {
  params.set("graduation_year", String(filters.graduation_year));
}

if (filters.current_title?.trim()) {
  params.set("current_title", filters.current_title.trim());
}

if (filters.current_company?.trim()) {
  params.set("current_company", filters.current_company.trim());
}

    if (filters.available_within_days > 0) {
      params.set(
        "available_within_days",
        String(filters.available_within_days)
      );
    }
    if (filters.min_candidate_score > 0) {
      params.set(
        "min_candidate_score",
        String(filters.min_candidate_score)
      );
    }
    params.set("limit", "50");
    console.log("Recruiter search filters being sent:", filters);
    const response = await fetch(
      `http://localhost:8080/api/v1/recruiter/candidates?${params.toString()}`,
      {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" },
      }
    );

    if (response.status === 401 || response.status === 403) {
      throw new Error(
        "Your recruiter session is no longer valid. Please sign in again."
      );
    }

    if (!response.ok) {
      throw new Error("Candidate search failed. Please try again.");
    }

    const data: CandidateSearchResponse = await response.json();

    setCandidates(data.candidates);
    setResultCount(data.count);


    const discoverResponse = await fetch(
      "http://localhost:8080/api/v1/recruiter/pipeline/discover",
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          candidate_ids: data.candidates.map((candidate) => candidate.id),
        }),
      },
    );

    if (discoverResponse.ok) {
      await loadPipelineCounts();
    } else {
      console.error(
        "Unable to add search results to pipeline:",
        await discoverResponse.text(),
      );
    }

  } catch (error) {
    setSearchError(
      error instanceof Error
        ? error.message
        : "Unable to search candidates. Check that the backend is running."
    );
  } finally {
    setIsSearching(false);
  }
}


async function loadPipelineCounts() {
  try {
    const response = await fetch(
      "http://localhost:8080/api/v1/recruiter/pipeline",
      {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" },
      },
    );

    if (!response.ok) return;

    const data: {
      items: { candidate_id: number; stage: string }[];
    } = await response.json();

    const stages: Record<number, string> = {};

    for (const item of data.items ?? []) {
      stages[item.candidate_id] = item.stage;
    }

    setCandidateStages(stages);

    const counts = {
      discovered: 0,
      contacted: 0,
      spoken: 0,
      negotiating: 0,
    };

    for (const item of data.items ?? []) {
      const stage = item.stage as keyof typeof counts;

      if (stage in counts) {
        counts[stage]++;
      }
    }

    setPipelineCounts(counts);
  } catch (error) {
    console.error("Unable to load recruitment pipeline:", error);
  }
}


async function updateCandidateStage(
  candidateId: number,
  stage: "discovered" | "contacted" | "spoken" | "negotiating",
) {
  try {
    const response = await fetch(
      "http://localhost:8080/api/v1/recruiter/pipeline",
      {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          candidate_id: candidateId,
          stage,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(await response.text());
    }

    await loadPipelineCounts();
  } catch (error) {
    console.error("Unable to update candidate stage:", error);
    alert("Could not update the candidate stage. Please try again.");
  }
}


  useEffect(() => {
    void loadPipelineCounts();
  }, []);


function openEmailDraft(candidate: Candidate) {
  const skills = candidate.skills?.length
    ? candidate.skills.join(", ")
    : "your technical background";

  setEmailCandidate(candidate);
  setEmailSubject("Opportunity that may match your experience");
  setEmailMessage(
    `Hi ${candidate.full_name},

I came across your profile and was interested in your experience with ${skills}${candidate.location ? ` in ${candidate.location}` : ""}.

We are reaching out regarding an opportunity that may align with your background. Would you be open to a brief conversation to discuss the opportunity and your interests?

Best regards,
Talent Acquisition Team`,
  );

  setEmailStatus("");
  setEmailError("");
}


async function sendCandidateEmail() {
  if (!emailCandidate) return;

  setIsSendingEmail(true);
  setEmailStatus("");
  setEmailError("");

  try {
    const response = await fetch(
      "http://localhost:8080/api/v1/recruiter/send-email",
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
        candidate_id: emailCandidate.id,
        to: emailCandidate.email,
        subject: emailSubject,
        message: emailMessage,
      }),
      },
    );

    if (response.status === 401 || response.status === 403) {
      throw new Error(
        "Your recruiter session is no longer valid. Please sign in again.",
      );
    }

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || "Email could not be sent.");
    }

    setEmailStatus(`Email sent successfully to ${emailCandidate.email}.`);
    await loadPipelineCounts();
  } catch (error) {
    setEmailError(
      error instanceof Error
        ? error.message
        : "Unable to send email. Check that the backend is running.",
    );
  } finally {
    setIsSendingEmail(false);
  }
}




  return (
    <main className="min-h-screen bg-[#F8F7FC] text-[#292544]">
      <div className="flex min-h-screen">
        <aside className="hidden w-[225px] shrink-0 border-r border-violet-100 bg-white lg:flex lg:flex-col">
          <div className="flex h-[72px] items-center gap-3 border-b border-violet-100 px-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#312E81] text-white shadow-md shadow-violet-200">
              <Sparkles size={19} />
            </div>
            <div>
              <p className="font-bold tracking-tight">Talentra <span className="text-violet-600">AI</span></p>
              <p className="text-[10px] tracking-[0.18em] text-stone-500">RECRUITER WORKSPACE</p>
            </div>
          </div>

          <nav className="flex-1 space-y-1 px-3 py-5">
            <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400">
              Workspace
            </p>
            {navigation.map(({ label, icon: Icon, target }) => (
            <button
              key={label}
              type="button"
              onClick={() => navigateToSection(target, label)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] transition ${
                activeNavigation === label
                  ? "bg-violet-100 font-semibold text-[#312E81]"
                  : "text-stone-600 hover:bg-violet-50 hover:text-violet-800"
              }`}
            >
              <Icon size={17} />
              <span>{label}</span>
              {activeNavigation === label && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-violet-600" />
              )}
            </button>
          ))}
          </nav>

          <div className="border-t border-violet-100 p-3">

            <div className="mt-2 flex items-center gap-3 rounded-xl bg-[#F8F7FC] p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-200 text-xs font-bold text-violet-900">
                TA
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">Recruiter account</p>
                <p className="text-[11px] text-stone-500">Talentra AI</p>
              </div>
              <ChevronDown size={15} className="text-stone-400" />
            </div>
                  <button
        type="button"
        onClick={onLogout}
        disabled={signingOut}
        className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-stone-600 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
      >
        <LogOut size={17} />
        <span>{signingOut ? "Signing out..." : "Sign out"}</span>
      </button>
          </div>
        </aside>

        <section className="min-w-0 flex-1">

          <div
  id="dashboard"
  className="mx-auto max-w-[1500px] space-y-6 p-5 sm:p-8"
>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-violet-600">
                  Your hiring workspace
                </p>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  Welcome to your workspace
                </h1>
                <p className="mt-2 text-sm text-stone-500">
                  Discover talent and manage your recruitment workflow.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">

            {metrics.map(({ label, key, note, icon: Icon }) => (
              <div
                key={label}
                className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm shadow-violet-100/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-stone-500">{label}</p>
                  <span className="rounded-lg bg-violet-50 p-2 text-violet-700">
                    <Icon size={17} />
                  </span>
                </div>

                <p className="mt-3 text-3xl font-bold tracking-tight">
                  {pipelineCounts[key as keyof typeof pipelineCounts]}
                </p>

                <p className="mt-2 text-[11px] text-stone-500">{note}</p>
              </div>
            ))}

            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
              <section id="recruitment-pipeline" className="talentra-enter talentra-card rounded-2xl border border-violet-100 bg-white p-5 shadow-sm shadow-violet-100/40 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-violet-100 p-2 text-violet-700">
                        <Workflow size={17} />
                      </span>
                      <h2 className="font-semibold">Recruitment pipeline</h2>
                    </div>
                    <p className="mt-2 text-xs text-stone-500">
                      Your candidate journey at a glance.
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-medium text-amber-700">
                    Awaiting activity
                  </span>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {["Discovered", "Contacted", "Spoken", "Negotiating"].map((stage, index) => (
                    <div key={stage} className="rounded-xl border border-stone-100 bg-stone-50/80 p-3">
                      <p className="text-[11px] text-stone-500">{stage}</p>
                      <p className="mt-2 text-2xl font-bold">
                      {pipelineCounts[stage.toLowerCase() as keyof typeof pipelineCounts]}
                    </p>
                      <div className={`mt-3 h-1 rounded-full ${["bg-violet-500", "bg-sky-500", "bg-amber-400", "bg-emerald-500"][index]}`} />
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-xl border border-dashed border-violet-200 bg-violet-50/50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-white p-2 text-violet-700">
                      <Activity size={17} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Your pipeline is ready</p>
                      <p className="mt-1 text-xs leading-5 text-stone-500">
                        Search for candidates to begin tracking outreach and recruitment progress.
                      </p>
                    </div>
                  </div>
                </div>
              </section>
              <section id="ai-search" className="talentra-enter talentra-enter-delay-1 talentra-card rounded-2xl border border-violet-200 bg-gradient-to-br from-white via-white to-violet-50 p-5 shadow-sm sm:p-6">               <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-violet-100 p-2 text-violet-700">
                    <Sparkles size={17} />
                  </span>
                  <h2 className="font-semibold">Find your next great hire</h2>
                </div>
                <p className="mt-3 text-xs leading-5 text-stone-500">
                  Describe your hiring needs and let Talentra AI help find matching candidates.
                </p>

                <div className="mt-5 rounded-xl border border-stone-200 bg-white p-3">

                    <textarea
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    aria-label="Describe the candidates you want to find"
                    placeholder="Describe the candidates you want to find..."
                    rows={3}
                    className="w-full resize-y border-0 bg-transparent text-xs leading-5 text-stone-700 outline-none placeholder:text-stone-400 focus:ring-0"
                    />

                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-stone-100 pt-3">
                    <button
                    type="button"
                    onClick={startVoiceSearch}
                    disabled={isListening || isSearching}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] text-violet-700 hover:bg-violet-50 disabled:opacity-60"
                  >
                    <Mic size={14} />
                    {isListening ? "Listening..." : "Search by voice"}
                  </button>

                        <button
                        type="button"
                        onClick={() => void handleSearch()}
                        disabled={isSearching || !searchText.trim()}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#4338CA] px-3 py-2 text-xs font-semibold text-white hover:bg-[#312E81] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                        <Search size={14} />
                        {isSearching ? "Searching..." : "Search candidates"}
                        </button>

                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  type="text"
                  value={enrichmentFilters.college}
                  onChange={(event) =>
                    setEnrichmentFilters((previous) => ({
                      ...previous,
                      college: event.target.value,
                    }))
                  }
                  placeholder="College"
                  aria-label="Filter by college"
                  className="rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-violet-500"
                />

                <input
                  type="number"
                  value={enrichmentFilters.graduation_year || ""}
                  onChange={(event) =>
                    setEnrichmentFilters((previous) => ({
                      ...previous,
                      graduation_year: Number(event.target.value) || 0,
                    }))
                  }
                  placeholder="Graduation year"
                  aria-label="Filter by graduation year"
                  min={1950}
                  max={2100}
                  className="rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-violet-500"
                />

                <input
                  type="text"
                  value={enrichmentFilters.current_title}
                  onChange={(event) =>
                    setEnrichmentFilters((previous) => ({
                      ...previous,
                      current_title: event.target.value,
                    }))
                  }
                  placeholder="Current job title"
                  aria-label="Filter by current job title"
                  className="rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-violet-500"
                />

                <input
                  type="text"
                  value={enrichmentFilters.current_company}
                  onChange={(event) =>
                    setEnrichmentFilters((previous) => ({
                      ...previous,
                      current_company: event.target.value,
                    }))
                  }
                  placeholder="Current company"
                  aria-label="Filter by current company"
                  className="rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-violet-500"
                />
              </div>
                    {activeFilters.length === 0 ? (
                        <span className="text-xs text-stone-400">
                        Your extracted filters will appear here after searching.
                        </span>
                    ) : (
                        activeFilters.map((filter) => (
                        <span
                            key={filter}
                            className="rounded-full border border-violet-100 bg-white px-3 py-1.5 text-xs text-violet-800"
                        >
                            {filter}
                        </span>
                        ))
                    )}
                </div>
                <p className="mt-4 text-[10px] text-stone-400">
                  Gemini AI interprets your request and searches matching candidate profiles.
                </p>
              </section>
            </div>

            <section id="candidate-directory" className="talentra-enter talentra-enter-delay-2 talentra-card rounded-2xl border border-violet-100 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                <h2 className="font-semibold">Candidate search results</h2>
                <p className="mt-1 text-xs text-stone-500">
                    {resultCount === null
                    ? "Run a search to find matching candidates."
                    : `${resultCount} matching candidate${resultCount === 1 ? "" : "s"} found`}
                </p>
                </div>
                {isSearching && (
                <span className="text-xs text-violet-700" role="status">
                    Searching candidates...
                </span>
                )}
            </div>

            {searchError && (
                <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
                {searchError}
                </p>
            )}

            {resultCount !== null && candidates.length === 0 && !searchError && (
                <p className="mt-4 rounded-lg bg-stone-50 p-4 text-sm text-stone-600">
                No candidates matched those filters. Try broadening your search.
                </p>
            )}

            <div className="mt-4 grid gap-3">
  {candidates.map((candidate) => (
    <article
      key={candidate.id}
      className="rounded-xl border border-stone-200 p-4"
    >
      <div className="flex flex-col justify-between gap-3 sm:flex-row">
        <div className="min-w-0">
          <h3 className="font-semibold text-[#312E81]">
            {candidate.full_name}
          </h3>

          <p className="mt-1 text-xs text-stone-500">
            {candidate.email}
          </p>

          <p className="mt-2 text-sm text-stone-700">
            {candidate.location} · {candidate.years_experience} years experience
          </p>

          {(candidate.current_title ||
            candidate.current_company ||
            candidate.college ||
            candidate.graduation_year) && (
            <div className="mt-3 space-y-1 text-xs text-stone-600">
              {(candidate.current_title || candidate.current_company) && (
                <p>
                  {candidate.current_title ?? "Title not specified"}
                  {candidate.current_company &&
                    ` · ${candidate.current_company}`}
                </p>
              )}

              {(candidate.college || candidate.graduation_year) && (
                <p>
                  {candidate.college ?? "College not specified"}
                  {candidate.graduation_year &&
                    ` · Graduated ${candidate.graduation_year}`}
                </p>
              )}
            </div>
          )}

          {candidate.linkedin_url && (
            <a
              href={candidate.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs font-medium text-violet-700 hover:text-violet-900"
            >
              View LinkedIn profile ↗
            </a>
          )}

          {candidate.source_reference && (
            <p className="mt-2 text-xs text-stone-400">
              Source reference: {candidate.source_reference}
            </p>
          )}
        </div>

        <div className="text-sm sm:text-right">
          <p>
            Expected CTC:{" "}
            {candidate.expected_ctc_lpa == null
              ? "Not specified"
              : `₹${candidate.expected_ctc_lpa} LPA`}
          </p>

          <p className="mt-1 text-stone-500">
            Availability:{" "}
            {candidate.availability_days == null
              ? "Not specified"
              : `${candidate.availability_days} days`}
          </p>

          <p className="mt-1 text-stone-500">
            Candidate score: {candidate.candidate_score ?? "Not scored"}
          </p>
        </div>
      </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                    {(candidate.skills ?? []).map((skill) => (
                        <span
                        key={skill}
                        className="rounded-full bg-violet-50 px-2.5 py-1 text-xs text-violet-800"
                        >
                        {skill}
                        </span>
                    ))}
                    </div>
                    <p className="mt-3 text-[10px] text-stone-400">
                    Data source: {candidate.source}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                    <label
                      htmlFor={`stage-${candidate.id}`}
                      className="text-sm font-medium text-stone-600"
                    >
                      Pipeline stage
                    </label>

                    <select
                      id={`stage-${candidate.id}`}
                      value={candidateStages[candidate.id] ?? "discovered"}
                      onChange={(event) =>
                        updateCandidateStage(
                          candidate.id,
                          event.target.value as
                            | "discovered"
                            | "contacted"
                            | "spoken"
                            | "negotiating",
                        )
                      }
                      className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 focus:border-violet-500 focus:outline-none"
                    >
                      <option value="discovered">Discovered</option>
                      <option value="contacted">Contacted</option>
                      <option value="spoken">Spoken</option>
                      <option value="negotiating">Negotiating</option>
                    </select>
                  </div>
                <button
                type="button"
                onClick={() => openEmailDraft(candidate)}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-violet-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-800"
              >
                <Mail className="h-4 w-4" />
                Draft outreach email
              </button>
              </article>
                ))}
            </div>
            </section>

<section id="external-sourcing" className="talentra-enter talentra-enter-delay-3 talentra-card rounded-2xl border border-violet-100 bg-white p-5 shadow-sm sm:p-6">
  <div className="flex items-center gap-2">
    <Search size={18} className="text-violet-700" />
    <h2 className="font-semibold">External sourcing : GitHub</h2>
  </div>

  <p className="mt-1 text-sm text-stone-500">
    Discover public developer profiles outside your Talentra database.
  </p>

  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
    <input
      value={githubLocation}
      onChange={(event) => setGithubLocation(event.target.value)}
      placeholder="Location (e.g. Pune)"
      aria-label="GitHub profile location"
      className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
    />
    <input
      value={githubLanguage}
      onChange={(event) => setGithubLanguage(event.target.value)}
      placeholder="Language (e.g. Python)"
      aria-label="GitHub programming language"
      className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
    />
  </div>

  <button
    type="button"
    onClick={() => void searchGitHubCandidates()}
    disabled={isGitHubSearching}
    className="mt-3 rounded-lg bg-[#4338CA] px-4 py-2 text-sm font-semibold text-white hover:bg-[#312E81] disabled:opacity-60"
  >
    {isGitHubSearching ? "Searching GitHub..." : "Search GitHub"}
  </button>

  {githubError && (
    <p className="mt-3 text-sm text-red-700" role="alert">
      {githubError}
    </p>
  )}

  <div className="mt-4 grid gap-3">
    {githubCandidates.map((candidate) => (
  <article
    key={candidate.username}
    className="flex items-start gap-3 rounded-xl border border-stone-200 p-3"
  >
    {candidate.avatar_url && (
      <img
        src={candidate.avatar_url}
        alt=""
        className="h-12 w-12 rounded-full"
      />
    )}

    <div className="min-w-0 flex-1">
      <h3 className="font-semibold text-[#312E81]">
        {candidate.full_name || candidate.username}
      </h3>

      <p className="text-xs text-stone-500">
        @{candidate.username}
        {candidate.location ? ` · ${candidate.location}` : ""}
        {candidate.skills ? ` · ${candidate.skills}` : ""}
      </p>

      {candidate.company && (
        <p className="mt-1 text-sm text-stone-600">
          {candidate.company}
        </p>
      )}

      {candidate.bio && (
        <p className="mt-1 text-sm text-stone-600">{candidate.bio}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <a
          href={candidate.profile_url}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-medium text-violet-700 underline"
        >
          View GitHub profile
        </a>

        <button
          type="button"
          onClick={() => void importGitHubCandidate(candidate)}
          disabled={githubImporting === candidate.username}
          className="rounded-lg bg-[#4338CA] px-3 py-2 text-sm font-semibold text-white hover:bg-[#312E81] disabled:opacity-60"
        >
          {githubImporting === candidate.username
            ? "Importing..."
            : "Import to Talentra"}
        </button>
      </div>

      {githubImportStatus[candidate.username] && (
        <p className="mt-2 text-sm text-stone-600" role="status">
          {githubImportStatus[candidate.username]}
        </p>
      )}
    </div>
  </article>
))}
  </div>

  {!isGitHubSearching &&
    !githubError &&
    githubCandidates.length === 0 && (
      <p className="mt-3 text-sm text-stone-400">
        Search to discover public GitHub profiles.
      </p>
    )}
</section>




            <section>
              <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Open roles</h2>
                  <p className="mt-1 text-xs text-stone-500">
                    Keep track of the positions you're hiring for.
                  </p>
                </div>

              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {roles.map((role) => (
                  <article key={role.title} className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm shadow-violet-100/40 transition hover:-translate-y-0.5 hover:shadow-md">
                    <div className="flex items-start gap-3">
                      <span className={`rounded-xl ${role.color} bg-opacity-10 p-2.5 text-violet-700`}>
                        <BriefcaseBusiness size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold">{role.title}</h3>
                        <p className="mt-1 text-xs text-stone-500">{role.subtitle}</p>
                      </div>
                    </div>
                    <div className="mt-5 border-t border-stone-100 pt-4">
                      <p className="text-xs text-stone-500">{role.count}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-violet-100 pt-4 text-[11px] text-stone-400">
              <span>Talentra AI · Recruiter workspace</span>
              <span className="inline-flex items-center gap-1.5">
                <Command size={12} /> Secure workspace
              </span>
            </footer>
          </div>
        </section>
      </div>


{emailCandidate && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-stone-900">
          Draft outreach email
        </h2>
        <button
          type="button"
          onClick={() => setEmailCandidate(null)}
          className="rounded-lg px-3 py-1 text-stone-500 hover:bg-stone-100"
        >
          Close
        </button>
      </div>

      <div className="mb-4 flex items-center gap-2">
  <label
    htmlFor="email-recipient"
    className="text-sm text-stone-600"
  >
    To:
  </label>
  <input
    id="email-recipient"
    type="email"
    value={emailCandidate.email}
    onChange={(event) =>
      setEmailCandidate({
        ...emailCandidate,
        email: event.target.value,
      })
    }
    className="min-w-0 flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900"
    required
  />
</div>

      <label className="mb-1 block text-sm font-medium text-stone-700">
        Subject
      </label>
      <input
        value={emailSubject}
        onChange={(event) => setEmailSubject(event.target.value)}
        className="mb-4 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
      />

      <label className="mb-1 block text-sm font-medium text-stone-700">
        Message
      </label>
      <textarea
        value={emailMessage}
        onChange={(event) => setEmailMessage(event.target.value)}
        rows={8}
        className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
      />

      {emailStatus && (
        <p className="mt-3 text-sm text-green-700">{emailStatus}</p>
      )}

      {emailError && (
        <p className="mt-3 text-sm text-red-600">{emailError}</p>
      )}

      <div className="mt-5 flex justify-end gap-3">
        <button
          type="button"
          onClick={() => setEmailCandidate(null)}
          className="rounded-lg border border-stone-300 px-4 py-2 text-sm"
        >
          Cancel
        </button>

          <button
            type="button"
            onClick={sendCandidateEmail}
            disabled={isSendingEmail || !emailSubject.trim() || !emailMessage.trim()}
            className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSendingEmail ? "Sending..." : "Review and send"}
          </button>
        </div>
      </div>
    </div>
  )}
  </main>

  );
}
