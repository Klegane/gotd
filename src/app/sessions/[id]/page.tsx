import { redirect } from "next/navigation";

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
      <section className="page-intro" aria-labelledby="session-page-title">
        <div>
          <p className="eyebrow">Sesión</p>
          <h1 id="session-page-title">Detalle de sesión</h1>
        </div>
        <p className="page-intro-copy">Votos, propuestas, participantes, mensajes y cierre de la sesión.</p>
      </section>
      <SessionDetailView
        sessionId={id}
        userId={session.user.id}
        userRole={session.user.role === "admin" ? "admin" : "user"}
      />
    </main>
  );
}
