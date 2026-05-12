import React, { type ReactNode } from "react";

import { AppHeader } from "@/components/AppHeader";
import { getCurrentSession, isSessionAuthenticated } from "@/server/auth";
import { ConfigurationError } from "@/server/env";

type AppShellProps = {
  children: ReactNode;
};

export async function AppShell({ children }: AppShellProps) {
  let session: Awaited<ReturnType<typeof getCurrentSession>> = null;

  try {
    session = await getCurrentSession();
  } catch (error) {
    if (!(error instanceof ConfigurationError)) {
      throw error;
    }
  }

  if (!isSessionAuthenticated(session)) {
    return <div className="public-shell">{children}</div>;
  }

  const userName = session.user.name ?? session.user.email ?? "Jugador";

  return (
    <div className="app-shell">
      <AppHeader userName={userName} userRole={session.user.role === "admin" ? "admin" : "user"} />
      <div className="app-content">{children}</div>
    </div>
  );
}
