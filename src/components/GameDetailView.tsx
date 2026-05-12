"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { GamePreferenceControl, type PreferenceState } from "@/components/GamePreferenceControl";
import { formatSessionDateSpanish } from "@/components/VotingDashboard";

type GameData = {
  id: string;
  bggId: number;
  name: string;
  yearPublished: number | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  playingTime: number | null;
  averageWeight: number | null;
  categories: string[];
  mechanisms: string[];
  families: string[];
  designers: string[];
  artists: string[];
  preference: PreferenceState | null;
  isExpansion: boolean;
  parentGame: {
    id: string;
    bggId: number;
    name: string;
    thumbnailUrl: string | null;
  } | null;
  expansions: Array<{
    id: string;
    bggId: number;
    name: string;
    yearPublished: number | null;
    thumbnailUrl: string | null;
  }>;
};

type SessionHistory = {
  id: string;
  localDate: string;
  title: string | null;
  locationName: string | null;
  wasWinner: boolean;
  totalVotes: number;
  gameVotes: number;
};

type GameDetailResponse = {
  game: GameData;
  history: SessionHistory[];
};

type GameDetailViewProps = {
  gameId: string;
};

export function GameDetailView({ gameId }: GameDetailViewProps) {
  const [data, setData] = useState<GameDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingPreference, setSavingPreference] = useState(false);

  const loadGame = useCallback(async () => {
    try {
      const response = await fetch(`/api/games/${gameId}`);

      if (!response.ok) {
        throw new Error("No se pudo cargar el juego.");
      }

      const result = (await response.json()) as GameDetailResponse;
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar el juego.");
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    void loadGame();
  }, [loadGame]);

  async function setPreference(preference: PreferenceState | null) {
    setSavingPreference(true);
    setError(null);

    try {
      const response = await fetch(`/api/preferences/games/${gameId}`, {
        method: preference ? "PUT" : "DELETE",
        headers: preference ? { "Content-Type": "application/json" } : undefined,
        body: preference ? JSON.stringify({ preference }) : undefined
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "No se pudo guardar la preferencia.");
      }

      setData((current) =>
        current
          ? {
              ...current,
              game: {
                ...current.game,
                preference
              }
            }
          : current
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la preferencia.");
    } finally {
      setSavingPreference(false);
    }
  }

  if (loading) {
    return <p id="game-detail-loading" className="status-line">Cargando juego...</p>;
  }

  if (!data) {
    return <p id="game-detail-not-found" className="status-line">{error ?? "Juego no encontrado."}</p>;
  }

  const { game, history } = data;
  const bggUrl = `https://boardgamegeek.com/boardgame/${game.bggId}`;

  return (
    <div id={`game-detail-view-${game.id}`} className="game-detail-page">
      <Link id="game-detail-back-link" href="/games" className="back-link">&larr; Volver al catálogo</Link>

      <div id="game-detail-profile" className={`game-detail-header ${game.preference ?? ""}`}>
        <img
          id="game-detail-image"
          src={game.imageUrl ?? game.thumbnailUrl ?? "/placeholder-game.svg"}
          alt={game.name}
          className="game-detail-image"
        />
        <div id="game-detail-info" className="game-detail-info">
          <h2 id="game-detail-title">{game.name}</h2>
          <GamePreferenceControl
            idPrefix={`game-detail-${game.id}`}
            preference={game.preference}
            onChange={setPreference}
            disabled={savingPreference}
          />
          {game.yearPublished ? <p className="status-line">{game.yearPublished}</p> : null}
          <div id="game-detail-stats" className="game-detail-stats">
            {game.minPlayers || game.maxPlayers ? (
              <span>
                {game.minPlayers && game.maxPlayers && game.minPlayers !== game.maxPlayers
                  ? `${game.minPlayers}–${game.maxPlayers} jugadores`
                  : `${game.minPlayers ?? game.maxPlayers} jugadores`}
              </span>
            ) : null}
            {game.playingTime ? <span>{game.playingTime} min</span> : null}
            {game.averageWeight ? <span>Peso {game.averageWeight.toFixed(1)}/5</span> : null}
          </div>
          {game.isExpansion && game.parentGame ? (
            <p className="status-line">
              Expansión de{" "}
              <Link id={`game-parent-link-${game.parentGame.id}`} href={`/games/${game.parentGame.id}`} className="game-link">
                {game.parentGame.name}
              </Link>
            </p>
          ) : null}
          <a id="game-detail-bgg-link" href={bggUrl} target="_blank" rel="noopener noreferrer" className="button primary bgg-link">
            Ver en BoardGameGeek
          </a>
        </div>
      </div>

      {/* Expansions */}
      {game.expansions.length > 0 ? (
        <section id="game-expansions-section" className="detail-section" aria-labelledby="game-expansions-title">
          <h3 id="game-expansions-title">Expansiones que poseo ({game.expansions.length})</h3>
          <div id="game-expansion-list" className="expansion-list">
            {game.expansions.map((exp) => (
              <Link id={`game-expansion-${exp.id}`} href={`/games/${exp.id}`} key={exp.id} className="expansion-row">
                <img
                  id={`game-expansion-image-${exp.id}`}
                  src={exp.thumbnailUrl ?? "/placeholder-game.svg"}
                  alt=""
                  className="expansion-thumb"
                  loading="lazy"
                />
                <span>{exp.name}</span>
                {exp.yearPublished ? <small>{exp.yearPublished}</small> : null}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* Session history */}
      <section id="game-session-history-section" className="detail-section" aria-labelledby="game-session-history-title">
        <h3 id="game-session-history-title">Historial de sesiones</h3>
        {history.length > 0 ? (
          <div id="game-session-history-list" className="game-history">
            {history.map((session) => (
              <Link id={`game-history-session-${session.id}`} href={`/sessions/${session.id}`} key={session.id} className="game-history-row">
                <div>
                  <strong>{formatSessionDateSpanish(session.localDate)}</strong>
                  {session.locationName ? <small> — {session.locationName}</small> : null}
                </div>
                <div className="game-history-result">
                  {session.wasWinner ? <span className="winner-badge">Ganador</span> : null}
                  <span>{session.gameVotes}/{session.totalVotes} votos</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p id="game-session-history-empty" className="status-line">Este juego aún no se ha jugado en ninguna sesión cerrada.</p>
        )}
      </section>
    </div>
  );
}
