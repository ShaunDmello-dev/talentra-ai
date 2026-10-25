
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import {
  Sparkles,
  BriefcaseBusiness,
  UserRoundSearch,
  Eye,
  EyeOff,
  Check,
  X,
  CircleAlert,
  UserRound,
} from "lucide-react";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
});

type Role = "recruiter" | "candidate";

function RegisterPage() {
  const [role, setRole] = useState<Role | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [company, setCompany] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formMessage, setFormMessage] = useState("");

  const passwordRules = [
    { label: "8+ characters", valid: password.length >= 8 },
    {
      label: "Upper & lowercase",
      valid: /[a-z]/.test(password) && /[A-Z]/.test(password),
    },
    { label: "A number", valid: /\d/.test(password) },
    { label: "A symbol", valid: /[^A-Za-z0-9]/.test(password) },
  ];

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const passwordValid = passwordRules.every((rule) => rule.valid);

  const errors = {
    role: !role,
    name: !name.trim(),
    email: !email.trim() || !emailValid,
    password: !passwordValid,
    company: role === "recruiter" && !company.trim(),
    terms: !acceptedTerms,
  };

  function inputClass(hasError: boolean) {
    return [
      "h-12 w-full rounded-xl border bg-white px-4 text-sm text-[#292524]",
      "outline-none transition placeholder:text-[#A8A29E]",
      "focus:border-[#7C3AED] focus:ring-4 focus:ring-[#7C3AED]/10",
      hasError && submitted
        ? "border-red-500 focus:border-red-500 focus:ring-red-100"
        : "border-[#E7E5E4] hover:border-[#C4B5FD]",
    ].join(" ");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    setFormMessage("");

    if (
      !role ||
      !name.trim() ||
      !emailValid ||
      !passwordValid ||
      (role === "recruiter" && !company.trim()) ||
      !acceptedTerms
    ) {
      return;
    }

   setLoading(true);

    try {
    const response = await fetch(
        "http://localhost:8080/api/v1/auth/register",
        {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            fullName: name.trim(),
            email: email.trim(),
            password,
            role,
            companyName: role === "recruiter" ? company.trim() : "",
        }),
        },
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
        data.error || data.message || "Registration failed.",
        );
    }

    setFormMessage(
        "Account created successfully! You can now sign in.",
    );
    } catch (error) {
    setFormMessage(
        error instanceof Error
        ? error.message
        : "Unable to connect to the server. Please try again.",
    );
    } finally {
    setLoading(false);
    }
}    

  if (formMessage.startsWith("Account created successfully!")) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FFF7ED] px-5 py-10">
        <section className="w-full max-w-md rounded-2xl border border-[#E7E5E4] bg-white p-8 text-center shadow-sm">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#312E81] text-white">
            <Sparkles size={24} />
          </span>
          <h1 className="mt-6 text-2xl font-bold text-[#312E81]">
            You're almost there
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#57534E]">
            {formMessage}
          </p>
          <Link
            to="/"
            className="mt-7 inline-flex h-11 items-center justify-center rounded-xl bg-[#7C3AED] px-6 text-sm font-semibold text-white hover:bg-[#6D28D9] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200"
          >
            Back to sign in
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-[#292524]">
      <div className="grid min-h-screen lg:grid-cols-[52%_48%]">
        <section className="relative flex min-h-screen flex-col px-6 py-7 sm:px-10 lg:px-12 xl:px-20">
          <Link
            to="/"
            aria-label="Talentra AI home"
            className="inline-flex w-fit items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] focus-visible:ring-offset-4"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#312E81] text-white">
              <Sparkles size={17} />
            </span>
            <span className="text-base font-bold tracking-tight text-[#312E81]">
              Talentra <span className="font-medium">AI</span>
            </span>
          </Link>

          <div className="mx-auto flex w-full max-w-[480px] flex-1 items-center py-10">
            <div className="w-full">
              <div className="mb-6">
                <h1 className="text-3xl font-bold tracking-tight text-[#312E81] sm:text-[36px]">
                  Create your account
                </h1>
                <p className="mt-2 text-sm leading-6 text-[#57534E] sm:text-base">
                  Join Talentra AI and find the right people or the right
                  opportunities.
                </p>
              </div>

              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                {/* Role selection */}
                <fieldset>
                  <legend className="sr-only">Choose your account type</legend>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <RoleCard
                      selected={role === "recruiter"}
                      title="I'm hiring"
                      description="Discover candidates and manage hiring for your company."
                      onClick={() => setRole("recruiter")}
                      icon={<BriefcaseBusiness size={19} />}
                    />
                    <RoleCard
                      selected={role === "candidate"}
                      title="I'm looking for opportunities"
                      description="Discover relevant jobs and manage your applications."
                      onClick={() => setRole("candidate")}
                      icon={<UserRoundSearch size={19} />}
                    />
                  </div>
                  {submitted && errors.role && (
                    <ErrorMessage>Choose an account type.</ErrorMessage>
                  )}
                </fieldset>

                <div>
                  <label htmlFor="full-name" className="form-label">
                    Full name
                  </label>
                  <input
                    id="full-name"
                    name="name"
                    autoComplete="name"
                    placeholder="Your full name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    aria-invalid={submitted && errors.name}
                    className={inputClass(errors.name)}
                  />
                  {submitted && errors.name && (
                    <ErrorMessage>Enter your full name.</ErrorMessage>
                  )}
                </div>

                <div>
                  <label htmlFor="register-email" className="form-label">
                    Email
                  </label>
                  <input
                    id="register-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    aria-invalid={submitted && errors.email}
                    className={inputClass(errors.email)}
                  />
                  {submitted && errors.email && (
                    <ErrorMessage>
                      Enter a valid email address, like you@example.com.
                    </ErrorMessage>
                  )}
                </div>

                <div>
                  <label htmlFor="register-password" className="form-label">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="register-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Create a password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      aria-invalid={submitted && errors.password}
                      aria-describedby="password-requirements"
                      className={`${inputClass(errors.password)} pr-12`}
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

                  {submitted && errors.password && (
                    <ErrorMessage>
                      Your password doesn't meet all the requirements below.
                    </ErrorMessage>
                  )}

                  <div
                    id="password-requirements"
                    className="mt-2 flex flex-wrap gap-x-3 gap-y-2"
                  >
                    {passwordRules.map((rule) => (
                      <span
                        key={rule.label}
                        className={`inline-flex items-center gap-1.5 text-xs ${
                          rule.valid ? "text-green-700" : "text-[#57534E]"
                        }`}
                      >
                        {rule.valid ? <Check size={14} /> : <X size={14} />}
                        {rule.label}
                      </span>
                    ))}
                  </div>
                </div>

                {role === "recruiter" && (
                  <div>
                    <label htmlFor="company-name" className="form-label">
                      Company name
                    </label>
                    <input
                      id="company-name"
                      name="company"
                      autoComplete="organization"
                      placeholder="Your company name"
                      value={company}
                      onChange={(event) => setCompany(event.target.value)}
                      aria-invalid={submitted && errors.company}
                      className={inputClass(errors.company)}
                    />
                    <p className="mt-1.5 text-xs text-[#57534E]">
                      The company you're hiring for.
                    </p>
                    {submitted && errors.company && (
                      <ErrorMessage>
                        Enter the company you're hiring for.
                      </ErrorMessage>
                    )}
                  </div>
                )}

                <div>
                  <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-[#292524]">
                    <input
                      type="checkbox"
                      checked={acceptedTerms}
                      onChange={(event) =>
                        setAcceptedTerms(event.target.checked)
                      }
                      className="mt-1 h-4 w-4 shrink-0 rounded accent-[#7C3AED] focus:ring-[#7C3AED]"
                    />
                    <span>
                      I agree to the{" "}
                      <a
                        href="/terms"
                        onClick={(event) => event.preventDefault()}
                        className="font-medium text-[#7C3AED] underline underline-offset-2"
                      >
                        Terms of Service
                      </a>{" "}
                      and{" "}
                      <a
                        href="/privacy"
                        onClick={(event) => event.preventDefault()}
                        className="font-medium text-[#7C3AED] underline underline-offset-2"
                      >
                        Privacy Policy
                      </a>
                      .
                    </span>
                  </label>
                  {submitted && errors.terms && (
                    <ErrorMessage>
                      Please accept the terms to continue.
                    </ErrorMessage>
                  )}
                </div>
                  {formMessage &&
                    !formMessage.startsWith("Account created successfully!") && (
                        <p className="text-sm text-red-600" role="alert">
                        {formMessage}
                        </p>
                    )}
                <button
                  type="submit"
                  disabled={loading}
                  className="flex h-12 w-full items-center justify-center rounded-xl bg-[#7C3AED] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#6D28D9] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#7C3AED]/30 focus-visible:ring-offset-2 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading
                    ? "Creating account..."
                    : role === "candidate"
                      ? "Create candidate account"
                      : role === "recruiter"
                        ? "Create recruiter account"
                        : "Create account"}
                </button>

                <p className="pt-1 text-center text-sm text-[#57534E]">
                  Already have an account?{" "}
                  <Link
                    to="/"
                    className="font-semibold text-[#7C3AED] hover:text-[#312E81] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]"
                  >
                    Sign in
                  </Link>
                </p>
              </form>
            </div>
          </div>

          <footer className="mt-auto pt-3 text-xs text-[#78716C]">
            © 2026 Talentra AI
          </footer>
        </section>

        <aside className="relative hidden min-h-screen overflow-hidden bg-[#FFF7ED] px-10 py-12 lg:flex lg:flex-col xl:px-16">
          <div className="relative z-10">
            <p className="flex items-center gap-2 text-sm font-medium text-[#312E81]">
              <span className="h-2 w-2 rounded-full bg-[#FB7185]" />
              Where talent meets opportunity.
            </p>
            <h2 className="mt-5 max-w-md text-4xl font-bold leading-[1.13] tracking-tight text-[#312E81] xl:text-[44px]">
              The right match, on both sides.
            </h2>
            <p className="mt-4 max-w-md text-base leading-7 text-[#292524]">
              AI-assisted matching that helps recruiters find the right people
              and candidates find the right roles.
            </p>
          </div>

          <div className="flex flex-1 items-center justify-center py-6">
            <MatchingIllustration />
          </div>

          <p className="relative z-10 text-sm text-[#312E81]">
            Smarter connections. Better possibilities.
          </p>
        </aside>

        <div className="flex items-center gap-3 border-t border-[#E7E5E4] bg-[#FFF7ED] px-6 py-5 lg:hidden">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#312E81] text-white">
            <Sparkles size={18} />
          </span>
          <div>
            <p className="text-sm font-semibold text-[#312E81]">
              The right match, on both sides.
            </p>
            <p className="text-xs text-[#57534E]">
              Smarter connections. Better possibilities.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function RoleCard({
  selected,
  title,
  description,
  icon,
  onClick,
}: {
  selected: boolean;
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`min-h-[116px] rounded-2xl border p-3.5 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#7C3AED]/20 ${
        selected
          ? "border-2 border-[#7C3AED] bg-[#F5F3FF]"
          : "border-[#E7E5E4] bg-white hover:border-[#C4B5FD]"
      }`}
    >
      <span className="flex items-start gap-2.5">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
            selected
              ? "bg-[#7C3AED] text-white"
              : "bg-[#FFF7ED] text-[#312E81]"
          }`}
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1 pt-0.5">
          <span className="block text-sm font-semibold leading-5 text-[#292524]">
            {title}
          </span>
        </span>
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
            selected
              ? "border-[#7C3AED] bg-[#7C3AED] text-white"
              : "border-[#D6D3D1] bg-white text-transparent"
          }`}
        >
          {selected && <Check size={13} strokeWidth={3} />}
        </span>
      </span>
      <span className="mt-2 block text-xs leading-[18px] text-[#57534E]">
        {description}
      </span>
    </button>
  );
}

function ErrorMessage({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-5 text-red-700" role="alert">
      <CircleAlert size={14} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function MatchingIllustration() {
  return (
    <div className="w-full max-w-[480px]">
      <svg
        viewBox="0 0 480 390"
        className="h-auto w-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Candidates and job opportunities connected through AI matching"
      >
        <circle cx="240" cy="190" r="148" stroke="#EDE2D5" />
        <circle cx="240" cy="190" r="118" stroke="#D8C7E8" strokeDasharray="3 5" />
        <circle cx="240" cy="190" r="89" stroke="#E6D8ED" strokeDasharray="3 5" />

        <path d="M95 118L204 173" stroke="#C4B5FD" strokeDasharray="3 5" />
        <path d="M92 245L201 204" stroke="#7C3AED" strokeWidth="1.5" />
        <path d="M375 116L278 174" stroke="#C4B5FD" strokeDasharray="3 5" />
        <path d="M384 238L280 204" stroke="#7C3AED" strokeWidth="1.5" />
        <path d="M118 310L211 221" stroke="#C4B5FD" strokeDasharray="3 5" />
        <path d="M250 108A91 91 0 0 1 303 157" stroke="#FB7185" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M278 190L383 190" stroke="#7C3AED" strokeWidth="2" />
        <path d="M93 245L184 225" stroke="#7C3AED" strokeWidth="2" />

        <circle cx="240" cy="190" r="62" fill="#E9D5FF" fillOpacity=".6" />
        <circle cx="240" cy="190" r="49" fill="#312E81" />
        <circle cx="229" cy="190" r="18" stroke="white" strokeWidth="3" />
        <circle cx="251" cy="190" r="18" stroke="#C4B5FD" strokeWidth="3" />
        <circle cx="240" cy="174" r="4" fill="#FB7185" />

        <circle cx="95" cy="118" r="20" fill="white" stroke="#D6D3D1" />
        <UserRound x={83} y={106} width={24} height={24} stroke="#312E81" strokeWidth={1.5} />

        <circle cx="92" cy="245" r="22" fill="#F3E8FF" />
        <circle cx="92" cy="245" r="17" fill="white" stroke="#7C3AED" strokeWidth="1.5" />
        <UserRound x={81} y={234} width={22} height={22} stroke="#7C3AED" strokeWidth={1.5} />

        <circle cx="118" cy="310" r="19" fill="white" stroke="#D6D3D1" />
        <UserRound x={108} y={300} width={20} height={20} stroke="#312E81" strokeWidth={1.5} />

        <rect x="355" y="96" width="40" height="40" rx="12" fill="white" stroke="#D6D3D1" />
        <BriefcaseBusiness x={365} y={106} width={20} height={20} stroke="#312E81" strokeWidth={1.5} />

        <circle cx="384" cy="238" r="23" fill="#F3E8FF" />
        <rect x="368" y="222" width="32" height="32" rx="10" fill="white" stroke="#7C3AED" strokeWidth="1.5" />
        <BriefcaseBusiness x={375} y={229} width={18} height={18} stroke="#7C3AED" strokeWidth={1.5} />

        <rect x="112" y="68" width="84" height="28" rx="14" fill="white" stroke="#F0E5DA" />
        <circle cx="126" cy="82" r="3" fill="#FB7185" />
        <text x="135" y="86" fill="#312E81" fontSize="11" fontWeight="500">React</text>

        <rect x="273" y="48" width="120" height="28" rx="14" fill="white" stroke="#F0E5DA" />
        <circle cx="287" cy="62" r="3" fill="#FB7185" />
        <text x="296" y="66" fill="#312E81" fontSize="11" fontWeight="500">Product Design</text>

        <rect x="157" y="264" width="112" height="28" rx="14" fill="white" stroke="#F0E5DA" />
        <circle cx="171" cy="278" r="3" fill="#FB7185" />
        <text x="180" y="282" fill="#312E81" fontSize="11" fontWeight="500">Data Science</text>

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
