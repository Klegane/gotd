import { redirect } from "next/navigation";

import { AuthButton } from "@/components/AuthButton";
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
      <header id="games-header" className="top-bar">
        <div id="games-title-block">
          <p className="eyebrow">Mesa del Dia</p>
          <h1>Juegos</h1>
        </div>
        <AuthButton idPrefix="games-auth" userName={session.user.name ?? session.user.email ?? "Jugador"} />
      </header>
      <GamesCatalogView />
    </main>
  );
}
