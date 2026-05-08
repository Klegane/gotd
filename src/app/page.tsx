import Link from "next/link";

import { AuthButton } from "@/components/AuthButton";
import { VotingDashboard } from "@/components/VotingDashboard";
import { getCurrentSession, isSessionAuthenticated } from "@/server/auth";
import { ConfigurationError } from "@/server/env";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let session: Awaited<ReturnType<typeof getCurrentSession>> = null;
  let configIssues: string[] = [];

  try {
    session = await getCurrentSession();
  } catch (error) {
    if (error instanceof ConfigurationError) {
      configIssues = error.issues;
    } else {
      throw error;
    }
  }

  if (configIssues.length > 0) {
    return (
      <main id="setup-page" className="page-shell">
        <section id="setup-configuration-panel" className="setup-panel">
          <p className="eyebrow">Setup needed</p>
          <h1>Finish local configuration before voting starts.</h1>
          <ul>
            {configIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </section>
      </main>
    );
  }

  if (!isSessionAuthenticated(session)) {
    return (
      <main id="login-page" className="page-shell login-shell">
        <section id="login-panel" className="login-copy">
          <p className="eyebrow">Game night</p>
          <h1>Pick the board game before the snacks run out.</h1>
          <p>Sign in with Google, choose a session, and let the table settle the rest.</p>
          <AuthButton idPrefix="login-auth" />
        </section>
      </main>
    );
  }

  return (
    <main id="home-page" className="page-shell">
      <header id="home-header" className="top-bar">
        <div id="home-title-block">
          <p className="eyebrow">Mesa del Dia</p>
          <h1>Choose the next board game.</h1>
        </div>
        <div id="home-actions" className="top-actions">
          <Link id="home-games-link" href="/games" className="button secondary">
            Juegos
          </Link>
          <AuthButton idPrefix="home-auth" userName={session.user.name ?? session.user.email ?? "Player"} />
        </div>
      </header>
      <VotingDashboard userRole={session.user.role === "admin" ? "admin" : "user"} />
    </main>
  );
}
