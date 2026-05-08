import { redirect } from "next/navigation";

import { AuthButton } from "@/components/AuthButton";
import { GameDetailView } from "@/components/GameDetailView";
import { getCurrentSession, isSessionAuthenticated } from "@/server/auth";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function GameDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await getCurrentSession();

  if (!isSessionAuthenticated(session)) {
    redirect("/");
  }

  return (
    <main id={`game-detail-page-${id}`} className="page-shell">
      <header id="game-detail-header" className="top-bar">
        <div id="game-detail-title-block">
          <p className="eyebrow">Mesa del Dia</p>
          <h1>Detalle de juego</h1>
        </div>
        <AuthButton idPrefix="game-detail-auth" userName={session.user.name ?? session.user.email ?? "Jugador"} />
      </header>
      <GameDetailView gameId={id} />
    </main>
  );
}
