import { redirect } from "next/navigation";

import { AuthButton } from "@/components/AuthButton";
import { SessionDetailView } from "@/components/SessionDetailView";
import { getCurrentSession, isSessionAuthenticated } from "@/server/auth";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function SessionDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await getCurrentSession();

  if (!isSessionAuthenticated(session)) {
    redirect("/");
  }

  return (
    <main id={`session-detail-page-${id}`} className="page-shell">
      <header id="session-page-header" className="top-bar">
        <div id="session-page-title-block">
          <p className="eyebrow">Mesa del Dia</p>
          <h1>Detalle de sesión</h1>
        </div>
        <AuthButton idPrefix="session-page-auth" userName={session.user.name ?? session.user.email ?? "Jugador"} />
      </header>
      <SessionDetailView
        sessionId={id}
        userId={session.user.id}
        userRole={session.user.role === "admin" ? "admin" : "user"}
      />
    </main>
  );
}
