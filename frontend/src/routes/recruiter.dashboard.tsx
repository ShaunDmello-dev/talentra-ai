
import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import RecruiterWorkspace from "../components/RecruiterWorkspace";

type AuthUser = {
  id: number;
  fullName: string;
  email: string;
  role: string;
};

function RecruiterDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function verifySession() {
      try {
        const response = await fetch(
          "http://localhost:8080/api/v1/auth/me",
          {
            method: "GET",
            credentials: "include",
          }
        );

        if (!response.ok) {
          if (active) {
            await navigate({ to: "/", replace: true });
          }
          return;
        }

        const data: { user: AuthUser } = await response.json();

        if (data.user.role !== "recruiter") {
          if (active) {
            await navigate({ to: "/", replace: true });
          }
          return;
        }

        if (active) {
          setUser(data.user);
        }
      } catch {
        if (active) {
          setError(
            "Unable to verify your session. Check that the backend is running."
          );
        }
      } finally {
        if (active) {
          setCheckingSession(false);
        }
      }
    }

    void verifySession();

    return () => {
      active = false;
    };
  }, [navigate]);

  async function handleLogout() {
    setSigningOut(true);
    setError("");

    try {
      const response = await fetch(
        "http://localhost:8080/api/v1/auth/logout",
        {
          method: "POST",
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Logout failed. Please try again.");
      }

      await navigate({ to: "/", replace: true });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to sign out. Please try again."
      );
    } finally {
      setSigningOut(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FFF7ED] px-6">
        <p className="text-sm font-medium text-[#312E81]" role="status">
          Verifying your session...
        </p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FFF7ED] px-6">
        <div className="max-w-md text-center">
          <p className="text-sm text-red-700" role="alert">
            {error || "Your session could not be verified."}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-[#7C3AED] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6D28D9]"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => void navigate({ to: "/" })}
            className="ml-3 rounded-lg px-4 py-2 text-sm font-semibold text-[#312E81] hover:bg-white"
          >
            Back to login
          </button>
        </div>
      </main>
    );
  }

 return (
  <RecruiterWorkspace
    onLogout={handleLogout}
    signingOut={signingOut}
  />
);
}

export const Route = createFileRoute("/recruiter/dashboard")({
  component: RecruiterDashboard,
});
