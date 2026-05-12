import { redirect } from "next/navigation";

import { ProfileView } from "@/components/ProfileView";
import { getCurrentSession, isSessionAuthenticated } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await getCurrentSession();

  if (!isSessionAuthenticated(session)) {
    redirect("/");
  }

  return (
    <main id="profile-page" className="page-shell">
      <section className="page-intro" aria-labelledby="profile-title">
        <div>
          <p className="eyebrow">Perfil</p>
          <h1 id="profile-title">Tu perfil</h1>
        </div>
        <p className="page-intro-copy">Identidad, preferencias, invitaciones e historial de puntos.</p>
      </section>
      <ProfileView />
    </main>
  );
}
