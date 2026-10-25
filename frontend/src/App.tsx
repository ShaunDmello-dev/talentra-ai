
import { useState, type FormEvent } from "react";
import {
  Eye,
  EyeOff,
  BriefcaseBusiness,
  UserRound,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

export default function App() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "http://localhost:8080/api/v1/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            email: email.trim(),
            password,
          }),
        }
      );

      const responseText = await response.text();

      let data: {
        message?: string;
        error?: string;
        user?: {
          id: number;
          fullName: string;
          email: string;
          role: string;
        };
      } = {};

      try {
        data = JSON.parse(responseText);
      } catch {
        data.message = responseText;
      }

      if (!response.ok) {
        throw new Error(
          data.error || data.message || "Login failed. Please try again."
        );
      }

      if (data.user?.role === "recruiter") {
        await navigate({ to: "/recruiter/dashboard" });
      } else if (data.user?.role === "candidate") {
        setMessage("Login successful! Your candidate dashboard is coming next.");
      } else if (data.user?.role === "admin") {
        setMessage("Login successful! Admin access will be added later.");
      } else {
        setError("Your account has an unrecognized role.");
      }   
    } catch (err) {
      if (err instanceof TypeError) {
        setError(
          "Could not connect to the server. Check that the backend is running."
        );
      } else {
        setError(
          err instanceof Error ? err.message : "Something went wrong."
        );
      }
    } finally {
      setLoading(false);
    }
  }


  return (
    <main className="talentra-login min-h-screen bg-white text-[#292524]">
      <div className="grid min-h-screen lg:grid-cols-[52%_48%]">
        {/* LEFT: LOGIN FORM */}
        <section className="relative flex min-h-screen flex-col px-6 py-7 sm:px-10 lg:px-14 xl:px-20">
          <a
            href="/"
            aria-label="Talentra AI home"
            className="inline-flex w-fit items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] focus-visible:ring-offset-4"
          >
            
            <span className="talentra-logo-mark relative flex h-9 w-9 items-center justify-center rounded-xl bg-[#312E81] text-white shadow-lg shadow-violet-900/15">
              <span className="talentra-logo-glow" aria-hidden="true" />
              <Sparkles
                className="talentra-logo-sparkle relative z-10"
                size={18}
                strokeWidth={2.2}
              />
            </span>

            <span className="text-base font-bold tracking-tight text-[#312E81]">
              Talentra <span className="font-medium">AI</span>
            </span>
          </a>

          <div className="flex flex-1 items-center justify-center py-14">
            <div className="talentra-entrance w-full max-w-[400px]">
              <div className="talentra-entrance talentra-delay-1 mb-8">
                <p className="mb-2 text-sm font-semibold text-[#7C3AED]">
                  YOUR NEXT CHAPTER STARTS HERE
                </p>
                <h1 className="text-3xl font-bold tracking-tight text-[#312E81] sm:text-[36px] sm:leading-[1.2]">
                  Welcome back
                </h1>
                <p className="mt-3 max-w-sm text-base leading-6 text-[#57534E]">
                  Sign in to discover talent, explore opportunities, and
                  continue where you left off.
                </p>
              </div>

              <form
                onSubmit={handleSubmit}
                noValidate
                className="talentra-entrance talentra-delay-2 space-y-5"
              >
                <div className="space-y-2">
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-[#292524]"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setError("");
                      setMessage("");
                    }}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? "login-error" : undefined}
                    className="h-12 w-full rounded-xl border border-[#E7E5E4] bg-white px-4 text-base text-[#292524] outline-none transition placeholder:text-[#A8A29E] hover:border-[#C4B5FD] focus:border-[#7C3AED] focus:ring-4 focus:ring-[#7C3AED]/10"
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-[#292524]"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value);
                        setError("");
                        setMessage("");
                      }}
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? "login-error" : undefined}
                      className="h-12 w-full rounded-xl border border-[#E7E5E4] bg-white px-4 pr-12 text-base text-[#292524] outline-none transition placeholder:text-[#A8A29E] hover:border-[#C4B5FD] focus:border-[#7C3AED] focus:ring-4 focus:ring-[#7C3AED]/10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((visible) => !visible)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-[#78716C] hover:text-[#7C3AED] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#7C3AED]"
                    >
                      {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm text-[#57534E]">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(event) => setRememberMe(event.target.checked)}
                      className="h-4 w-4 rounded border-[#D6D3D1] accent-[#7C3AED] focus:ring-[#7C3AED]"
                    />
                    Remember me
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setError("");
                      setMessage(
                        "Password reset is not connected yet. We'll add it after the login and registration flows."
                      );
                    }}
                    className="rounded text-sm font-medium text-[#7C3AED] hover:text-[#312E81] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] focus-visible:ring-offset-2"
                  >
                    Forgot password?
                  </button>
                </div>

                {error && (
                  <p
                    id="login-error"
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800"
                  >
                    {error}
                  </p>
                )}

                {message && (
                  <p
                    role="status"
                    className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5 text-sm leading-5 text-[#312E81]"
                  >
                    {message}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="talentra-interactive flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#7C3AED] px-5 text-base font-semibold text-white shadow-sm transition hover:bg-[#6D28D9] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#7C3AED]/30 focus-visible:ring-offset-2 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? "Please wait..." : "Sign in"}
                  {!loading && <ArrowUpRight size={17} />}
                </button>
              </form>

              <p className="mt-7 text-center text-sm text-[#57534E]">
                Don't have an account?{" "}
                
              <button
                type="button"
                onClick={() => void navigate({ to: "/register" })}
                className="rounded font-semibold text-[#7C3AED] hover:text-[#312E81] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]"
                >
                  Create an account
                </button>

              </p>
            </div>
          </div>

          <footer className="mt-auto pt-4 text-xs text-[#78716C]">
            © 2026 Talentra AI
          </footer>
        </section>

        
        {/* RIGHT: BRAND PANEL */}
        <aside className="relative hidden min-h-screen overflow-hidden bg-[#FFF7ED] px-10 py-12 lg:flex lg:flex-col lg:px-12 xl:px-16">
          {/* Ambient background glows */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-16 h-72 w-72 rounded-full bg-[#FB7185]/15 blur-3xl talentra-glow"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-16 -left-16 h-80 w-80 rounded-full bg-[#7C3AED]/15 blur-3xl talentra-glow talentra-glow-reverse"
          />

          <div className="relative z-10">
            <p className="flex items-center gap-2 text-sm font-medium text-[#312E81]">
              <span className="h-2 w-2 rounded-full bg-[#FB7185]" />
              Where talent meets opportunity.
            </p>
            <h2 className="mt-5 max-w-md text-4xl font-bold leading-[1.13] tracking-tight text-[#312E81] xl:text-[44px]">
              The right match, on both sides.
            </h2>
            <p className="mt-4 max-w-md text-base leading-7 text-[#57534E]">
              AI-assisted matching that helps recruiters find the right people
              and candidates find the right roles.
            </p>
          </div>

          <div className="talentra-entrance talentra-delay-2 flex flex-1 items-center justify-center py-8">
            <MatchingIllustration />
          </div>

          <p className="relative z-10 text-xs text-[#78716C]">
            Smarter connections. Better possibilities.
          </p>
        </aside>

        {/* Compact brand accent on mobile */}
        <div className="flex items-center gap-2 border-t border-[#E7E5E4] bg-[#FFF7ED] px-6 py-5 lg:hidden">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#312E81] text-white">
            <Sparkles size={16} />
          </span>
          <div>
            <p className="text-sm font-semibold text-[#312E81]">
              Great teams start with the right match.
            </p>
            <p className="mt-0.5 text-xs text-[#57534E]">
              Talent and opportunities, connected.
            </p>
                </div>
      </div>
    </div>
  </main>
  );
}

function MatchingIllustration() {
  return (
    <div
      className="talentra-float relative w-full max-w-[480px]"
      role="img"
      aria-label="Illustration of candidates and job opportunities connected through AI matching"
    >
      <svg
        viewBox="0 0 480 390"
        className="h-auto w-full overflow-visible"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle cx="240" cy="190" r="148" stroke="#EDE2D5" />
        <circle cx="240" cy="190" r="118" stroke="#E6D8ED" strokeDasharray="2 5" />
        <circle cx="240" cy="190" r="89" stroke="#E6D8ED" strokeDasharray="2 5" />

        <path d="M95 118L204 173" stroke="#C4B5FD" strokeDasharray="3 5" />
        <path d="M92 245L201 204" stroke="#7C3AED" strokeWidth="1.5" />
        <path d="M375 116L278 174" stroke="#C4B5FD" strokeDasharray="3 5" />
        <path d="M384 238L280 204" stroke="#7C3AED" strokeWidth="1.5" />
        <path d="M118 310L211 221" stroke="#C4B5FD" strokeDasharray="3 5" />

        <path d="M250 108A91 91 0 0 1 303 157" stroke="#FB7185" strokeWidth="2" strokeLinecap="round" />
        <path d="M278 190L383 190" stroke="#7C3AED" strokeWidth="2" />
        <path d="M93 245L184 225" stroke="#7C3AED" strokeWidth="2" />

        <circle cx="240" cy="190" r="62" fill="#E9D5FF" fillOpacity=".55" />
        <circle cx="240" cy="190" r="49" fill="#312E81" />
        <circle cx="229" cy="190" r="18" stroke="white" strokeWidth="3" />
        <circle cx="251" cy="190" r="18" stroke="#C4B5FD" strokeWidth="3" />
        <circle cx="240" cy="174" r="4" fill="#FB7185" />

        {/* Candidate nodes */}
        <circle cx="95" cy="118" r="20" fill="white" stroke="#E7E5E4" />
        <UserRound x={83} y={106} width={24} height={24} stroke="#57534E" strokeWidth={1.5} />

        <circle cx="92" cy="245" r="22" fill="#F3E8FF" />
        <circle cx="92" cy="245" r="17" fill="white" stroke="#7C3AED" strokeWidth="1.5" />
        <UserRound x={81} y={234} width={22} height={22} stroke="#7C3AED" strokeWidth={1.5} />

        <circle cx="118" cy="310" r="19" fill="white" stroke="#E7E5E4" />
        <UserRound x={108} y={300} width={20} height={20} stroke="#57534E" strokeWidth={1.5} />

        {/* Opportunity nodes */}
        <rect x="355" y="96" width="40" height="40" rx="12" fill="white" stroke="#E7E5E4" />
        <BriefcaseBusiness x={365} y={106} width={20} height={20} stroke="#57534E" strokeWidth={1.5} />

        <circle cx="384" cy="238" r="23" fill="#F3E8FF" />
        <rect x="368" y="222" width="32" height="32" rx="10" fill="white" stroke="#7C3AED" strokeWidth="1.5" />
        <BriefcaseBusiness x={375} y={229} width={18} height={18} stroke="#7C3AED" strokeWidth={1.5} />

        {/* Skill labels */}
        <rect x="112" y="68" width="84" height="28" rx="14" fill="white" stroke="#F0E5DA" />
        <circle cx="126" cy="82" r="3" fill="#FB7185" />
        <text x="135" y="86" fill="#312E81" fontSize="11" fontWeight="500">React</text>

        <rect x="273" y="48" width="120" height="28" rx="14" fill="white" stroke="#F0E5DA" />
        <circle cx="287" cy="62" r="3" fill="#FB7185" />
        <text x="296" y="66" fill="#312E81" fontSize="11" fontWeight="500">Product Design</text>

        <rect x="157" y="264" width="112" height="28" rx="14" fill="white" stroke="#F0E5DA" />
        <circle cx="171" cy="278" r="3" fill="#FB7185" />
        <text x="180" y="282" fill="#312E81" fontSize="11" fontWeight="500">Data Science</text>

        {/* Match card */}
        <rect x="272" y="268" width="186" height="105" rx="14" fill="#E7DCCF" fillOpacity=".45" />
        <rect x="266" y="262" width="186" height="105" rx="14" fill="white" stroke="#F0E5DA" />
        <circle cx="283" cy="280" r="3" fill="#FB7185" />
        <text x="292" y="284" fill="#312E81" fontSize="11" fontWeight="600">Strong match</text>

        <circle cx="283" cy="302" r="6" fill="#EDE9FE" />
        <path d="M280 302L282 304L286 300" stroke="#7C3AED" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        <text x="295" y="306" fill="#57534E" fontSize="10.5">Skills aligned</text>

        <circle cx="283" cy="321" r="6" fill="#EDE9FE" />
        <path d="M280 321L282 323L286 319" stroke="#7C3AED" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        <text x="295" y="325" fill="#57534E" fontSize="10.5">Experience matched</text>

        <circle cx="283" cy="340" r="6" fill="#EDE9FE" />
        <path d="M280 340L282 342L286 338" stroke="#7C3AED" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        <text x="295" y="344" fill="#57534E" fontSize="10.5">Opportunity discovered</text>

        <circle cx="65" cy="185" r="2.5" fill="#FB7185" />
        <circle cx="327" cy="212" r="2.5" fill="#FB7185" />
        <circle cx="208" cy="324" r="2.5" fill="#FB7185" />
      </svg>
    </div>
  );
}
