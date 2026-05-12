"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";

type ProfileGame = {
  id: string;
  name: string;
  thumbnailUrl: string | null;
  imageUrl?: string | null;
  yearPublished?: number | null;
};

type ProfileSession = {
  participationStatus: string;
  session: {
    id: string;
    title: string;
    localDate: string;
    localStartTime: string | null;
    status: string;
    playedGame?: {
      id: string;
      name: string;
      thumbnailUrl: string | null;
    } | null;
  };
};

type LedgerEntry = {
  id: string;
  amount: number;
  reason: string;
  createdAt: string;
  game: ProfileGame | null;
  session: {
    id: string;
    title: string;
    localDate: string;
  } | null;
};

type ProfileData = {
  user: {
    id: string;
    displayName: string;
    nickname: string | null;
    name: string | null;
    email: string | null;
    image: string | null;
    role: string;
  };
  favorites: ProfileGame[];
  vetoes: ProfileGame[];
  vetoCapacity: {
    used: number;
    max: number;
    remaining: number;
  };
  pointBalance: number;
  pointLedger: LedgerEntry[];
  upcomingSessions: ProfileSession[];
  pastPlayedSessions: ProfileSession[];
};

export function ProfileView() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [nickname, setNickname] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadProfile() {
    const response = await fetch("/api/profile");

    if (!response.ok) {
      setMessage("No se pudo cargar el perfil.");
      return;
    }

    const body = (await response.json()) as ProfileData;
    setProfile(body);
    setNickname(body.user.nickname ?? "");
  }

  async function saveProfile() {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "No se pudo guardar el perfil.");
      }

      await loadProfile();
      setMessage("Perfil guardado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el perfil.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    void loadProfile();
  }, []);

  if (!profile) {
    return <p id="profile-loading" className="status-line">{message ?? "Cargando perfil..."}</p>;
  }

  return (
    <div id="profile-view" className="profile-page">
      <Link id="profile-back-link" href="/" className="back-link">&larr; Volver a sesiones</Link>
      <section id="profile-header" className="profile-header">
        {profile.user.image ? <img src={profile.user.image} alt="" className="profile-avatar" /> : null}
        <div>
          <p className="eyebrow">Perfil</p>
          <h2>{profile.user.displayName}</h2>
          <p className="status-line">{profile.user.email}</p>
        </div>
      </section>

      <section id="profile-edit" className="detail-section">
        <h3>Nickname</h3>
        <div className="inline-form">
          <input
            id="profile-nickname-input"
            name="profile-nickname"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            maxLength={32}
          />
          <button id="profile-save-button" type="button" className="button primary" onClick={saveProfile} disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
        {message ? <p className="status-line">{message}</p> : null}
      </section>

      <div className="profile-grid">
        <section id="profile-points" className="detail-section">
          <h3>Puntos</h3>
          <p className="profile-number">{profile.pointBalance}</p>
          <div className="ledger-list">
            {profile.pointLedger.map((entry) => (
              <div className="ledger-row" key={entry.id}>
                <strong>{entry.amount > 0 ? `+${entry.amount}` : entry.amount}</strong>
                <span>{entry.reason}</span>
                <small>{new Date(entry.createdAt).toLocaleDateString("es-ES")}</small>
              </div>
            ))}
          </div>
        </section>

        <PreferenceList id="profile-favorites" title="Favoritos" games={profile.favorites} />
        <PreferenceList
          id="profile-vetoes"
          title={`Vetos (${profile.vetoCapacity.used}/${profile.vetoCapacity.max})`}
          games={profile.vetoes}
        />
        <SessionList id="profile-upcoming" title="Próximas invitaciones" sessions={profile.upcomingSessions} />
        <SessionList id="profile-past" title="Sesiones jugadas" sessions={profile.pastPlayedSessions} />
      </div>
    </div>
  );
}

function PreferenceList({ id, title, games }: { id: string; title: string; games: ProfileGame[] }) {
  return (
    <section id={id} className="detail-section">
      <h3>{title}</h3>
      {games.length === 0 ? (
        <p className="status-line">Sin juegos.</p>
      ) : (
        <div className="compact-game-list">
          {games.map((game) => (
            <Link key={game.id} href={`/games/${game.id}`} className="compact-game-row">
              <img src={game.thumbnailUrl ?? game.imageUrl ?? "/placeholder-game.svg"} alt="" />
              <span>{game.name}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function SessionList({ id, title, sessions }: { id: string; title: string; sessions: ProfileSession[] }) {
  return (
    <section id={id} className="detail-section">
      <h3>{title}</h3>
      {sessions.length === 0 ? (
        <p className="status-line">Sin sesiones.</p>
      ) : (
        <div className="profile-session-list">
          {sessions.map((item) => (
            <Link key={`${item.session.id}-${item.participationStatus}`} href={`/sessions/${item.session.id}`} className="profile-session-row">
              <strong>{item.session.title}</strong>
              <span>{item.session.localDate}{item.session.localStartTime ? ` ${item.session.localStartTime}` : ""}</span>
              <small>{item.participationStatus}{item.session.playedGame ? ` · ${item.session.playedGame.name}` : ""}</small>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
