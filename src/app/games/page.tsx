import { redirect } from "next/navigation";

import { GamesCatalogView } from "@/components/GamesCatalogView";
import { getCurrentSession, isSessionAuthenticated } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function GamesPage() {
  const session = await getCurrentSession();

  if (!isSessionAuthenticated(session)) {
    redirect("/");
  }

  return (
    <main id="games-page" className="page-shell">
      <section className="page-intro" aria-labelledby="games-title">
        <div>
          <p className="eyebrow">Catálogo</p>
          <h1 id="games-title">Juegos</h1>
        </div>
        <p className="page-intro-copy">Busca, revisa preferencias y abre el detalle de cada juego.</p>
      </section>
      <GamesCatalogView />
    </main>
  );
}
