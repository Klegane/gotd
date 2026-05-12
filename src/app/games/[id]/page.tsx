import { redirect } from "next/navigation";

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
      <section className="page-intro" aria-labelledby="game-detail-title">
        <div>
          <p className="eyebrow">Catálogo</p>
          <h1 id="game-detail-title">Detalle de juego</h1>
        </div>
        <p className="page-intro-copy">Preferencias, expansiones e historial de partidas del juego.</p>
      </section>
      <GameDetailView gameId={id} />
    </main>
  );
}
