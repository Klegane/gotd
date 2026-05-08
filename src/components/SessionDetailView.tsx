"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { GameCurationPanel } from "@/components/GameCurationPanel";
import { GamePreferenceControl } from "@/components/GamePreferenceControl";
import { PlacesAddressInput } from "@/components/PlacesAddressInput";
import {
  formatSessionDateSpanish,
  formatSessionTime,
  playersLabel,
  sessionDisplayTitle,
  type Game,
  type PreferenceState
} from "@/components/VotingDashboard";

type SessionStatus = "draft" | "open" | "closed" | "cancelled";

type LocationInfo = {
  id: string;
  name: string;
  address: string;
};

type VoteResult = {
  gameId: string;
  gameName: string;
  thumbnailUrl: string | null;
  votes: number;
};

type VoteResults = {
  totalVotes: number;
  leaders: VoteResult[];
  items: VoteResult[];
};

type SessionData = {
  id: string;
  localDate: string;
  localStartTime: string | null;
  localEndTime: string | null;
  title: string;
  customTitle: string | null;
  notes: string | null;
  status: SessionStatus;
  location: LocationInfo | null;
  createdByUserId: string | null;
};

type AllVote = {
  userId: string;
  userName: string | null;
  userImage: string | null;
  gameId: string;
  gameName: string;
  gameThumbnailUrl: string | null;
};

type SessionState = {
  session: SessionData;
  games: Game[];
  currentVote: {
    gameId: string;
    game: {
      name: string;
    };
  } | null;
  results: VoteResults;
  curatedGameIds: string[];
  canCurateGames: boolean;
  allVotes: AllVote[];
};

type Message = {
  id: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    image: string | null;
  };
};

type SessionDetailViewProps = {
  sessionId: string;
  userId: string;
  userRole: "admin" | "user";
};

export function SessionDetailView({ sessionId, userId, userRole }: SessionDetailViewProps) {
  const [data, setData] = useState<SessionState | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [locations, setLocations] = useState<LocationInfo[]>([]);
  const [catalogGames, setCatalogGames] = useState<Game[]>([]);
  const [curatedIds, setCuratedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [savingLocation, setSavingLocation] = useState(false);
  const [newLocationName, setNewLocationName] = useState("");
  const [newLocationAddress, setNewLocationAddress] = useState("");
  const [creatingLocation, setCreatingLocation] = useState(false);
  const [showNewLocationForm, setShowNewLocationForm] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const canEditNotes = data && (data.session.createdByUserId === userId || userRole === "admin");

  const loadSession = useCallback(async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`);

      if (!response.ok) {
        throw new Error("No se pudo cargar la sesión.");
      }

      const result = (await response.json()) as SessionState;
      setData(result);
      setCuratedIds(result.curatedGameIds);
      setNotesText(result.session.notes ?? "");
      setSelectedLocationId(result.session.location?.id ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar la sesión.");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const loadMessages = useCallback(async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/messages`);

      if (response.ok) {
        const body = (await response.json()) as { messages: Message[] };
        setMessages(body.messages);
      }
    } catch {
      // Silently fail on message polling
    }
  }, [sessionId]);

  const loadLocations = useCallback(async () => {
    try {
      const response = await fetch("/api/locations");

      if (response.ok) {
        const body = (await response.json()) as { locations: LocationInfo[] };
        setLocations(body.locations);
      }
    } catch {
      // Silently fail
    }
  }, []);

  const loadCatalog = useCallback(async () => {
    try {
      const response = await fetch("/api/catalog");

      if (response.ok) {
        const body = (await response.json()) as { games: Game[] };
        setCatalogGames(body.games);
      }
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    void loadSession();
    void loadMessages();
    void loadLocations();
    void loadCatalog();
  }, [loadSession, loadMessages, loadLocations, loadCatalog]);

  // Poll messages every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      void loadMessages();
    }, 15000);

    return () => clearInterval(interval);
  }, [loadMessages]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Group votes by game for display
  const votesByGame = data
    ? data.results.items.map((item) => ({
        ...item,
        voters: data.allVotes
          .filter((v) => v.gameId === item.gameId)
          .map((v) => ({ name: v.userName ?? "Anónimo", image: v.userImage }))
      }))
    : [];

  async function vote(gameId: string) {
    setWorking(gameId);
    setError(null);

    try {
      const response = await fetch(`/api/sessions/${sessionId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "No se pudo guardar tu voto.");
      }

      setData((await response.json()) as SessionState);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar tu voto.");
    } finally {
      setWorking(null);
    }
  }

  async function setPreference(gameId: string, preference: PreferenceState | null) {
    setWorking(`${gameId}-${preference ?? "clear"}`);
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

      await loadSession();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la preferencia.");
    } finally {
      setWorking(null);
    }
  }

  async function saveCuratedGames() {
    setWorking("curate-games");
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/admin/sessions/${sessionId}/games`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameIds: curatedIds })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "No se pudo actualizar la selección de juegos.");
      }

      await loadSession();
      setNotice("Selección de juegos actualizada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la selección de juegos.");
    } finally {
      setWorking(null);
    }
  }

  async function sendMessage() {
    if (!newMessage.trim()) return;

    setSendingMessage(true);

    try {
      const response = await fetch(`/api/sessions/${sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newMessage })
      });

      if (!response.ok) {
        throw new Error("No se pudo enviar el mensaje.");
      }

      setNewMessage("");
      await loadMessages();
    } catch {
      setError("No se pudo enviar el mensaje.");
    } finally {
      setSendingMessage(false);
    }
  }

  async function saveNotes() {
    setSavingNotes(true);

    try {
      const response = await fetch(`/api/sessions/${sessionId}/notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notesText })
      });

      if (!response.ok) {
        throw new Error("No se pudieron guardar las notas.");
      }

      setEditingNotes(false);
      await loadSession();
    } catch {
      setError("No se pudieron guardar las notas.");
    } finally {
      setSavingNotes(false);
    }
  }

  async function saveLocation() {
    setSavingLocation(true);

    try {
      const response = await fetch(`/api/admin/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: selectedLocationId || null })
      });

      if (!response.ok) {
        throw new Error("No se pudo actualizar el lugar.");
      }

      await loadSession();
    } catch {
      setError("No se pudo actualizar el lugar.");
    } finally {
      setSavingLocation(false);
    }
  }

  async function createNewLocation() {
    if (!newLocationName.trim() || !newLocationAddress.trim()) return;

    setCreatingLocation(true);

    try {
      const response = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newLocationName.trim(), address: newLocationAddress.trim() })
      });

      if (!response.ok) {
        throw new Error("No se pudo crear el lugar.");
      }

      setNewLocationName("");
      setNewLocationAddress("");
      setShowNewLocationForm(false);
      await loadLocations();
    } catch {
      setError("No se pudo crear el lugar.");
    } finally {
      setCreatingLocation(false);
    }
  }

  if (loading) {
    return <p id="session-detail-loading" className="status-line">Cargando sesión...</p>;
  }

  if (!data) {
    return <p id="session-detail-not-found" className="status-line">{error ?? "Sesión no encontrada."}</p>;
  }

  return (
    <div id={`session-detail-view-${sessionId}`} className="session-detail-page">
      <Link id="session-detail-back-link" href="/" className="back-link">&larr; Volver al calendario</Link>

      <div id="session-detail-header" className="session-detail-header">
        <div id="session-detail-title-block">
          <p className="eyebrow">{formatSessionDateSpanish(data.session.localDate)}</p>
          <h2 id="session-detail-title">{sessionDisplayTitle(data.session)}</h2>
          <p className="status-line">{formatSessionTime(data.session)}</p>
          {data.session.location ? (
            <p className="status-line">{data.session.location.name} — {data.session.location.address}</p>
          ) : null}
        </div>
        <span id="session-detail-status" className={`status-pill ${data.session.status}`}>{data.session.status}</span>
      </div>

      {error ? <p id="session-detail-error" className="status-line" style={{ color: "var(--coral)" }}>{error}</p> : null}
      {notice ? <p id="session-detail-notice" className="status-line">{notice}</p> : null}

      {data.canCurateGames ? (
        <section id="session-detail-curation-section" className="detail-section">
          <GameCurationPanel
            idPrefix="session-game-curation"
            games={catalogGames}
            selectedGameIds={curatedIds}
            onSelectedGameIdsChange={setCuratedIds}
            onSave={saveCuratedGames}
            saving={working === "curate-games"}
          />
        </section>
      ) : null}

      {/* Available games */}
      <section id="session-games-section" className="detail-section" aria-labelledby="session-games-title">
        <div id="session-games-header" className="detail-section-header">
          <div>
            <h3 id="session-games-title">Juegos disponibles</h3>
            <p id="session-current-vote-summary" className="status-line">
              {data.currentVote ? `Tu voto: ${data.currentVote.game.name}` : "Elige un juego para esta sesión."}
            </p>
          </div>
        </div>

        {data.games.length === 0 ? (
          <div id="session-games-empty-state" className="empty-state">
            <h3>No hay juegos disponibles para esta sesión.</h3>
            <p>Actualiza BoardGameGeek o pide a un admin que ajuste la lista de juegos.</p>
          </div>
        ) : (
          <div id="session-detail-game-grid" className="game-grid session-detail-game-grid">
            {data.games.map((game) => {
              const selected = data.currentVote?.gameId === game.id;
              const canVote = data.session.status === "open";

              return (
                <article
                  id={`session-detail-game-card-${game.id}`}
                  className={`game-card${selected ? " selected" : ""} ${game.preference ?? ""}`}
                  key={game.id}
                >
                  <img
                    id={`session-detail-game-image-${game.id}`}
                    src={game.thumbnailUrl ?? game.imageUrl ?? "/placeholder-game.svg"}
                    alt=""
                    className="game-thumb"
                    loading="lazy"
                  />
                  <div className="game-copy">
                    <h3>
                      <Link id={`session-detail-game-link-${game.id}`} href={`/games/${game.id}`} className="game-link">
                        {game.name}
                      </Link>
                    </h3>
                    <p>{game.yearPublished ? game.yearPublished : "Año desconocido"}</p>
                    <p>
                      {playersLabel(game)}
                      {game.playingTime ? ` — ${game.playingTime} min` : ""}
                    </p>
                    <p>{game.averageWeight ? `Peso ${game.averageWeight.toFixed(1)}/5` : "Peso desconocido"}</p>
                    <GamePreferenceControl
                      idPrefix={`session-detail-game-${game.id}`}
                      preference={game.preference}
                      onChange={(preference) => setPreference(game.id, preference)}
                      disabled={working?.startsWith(`${game.id}-`) ?? false}
                    />
                  </div>
                  <div className="card-actions">
                    <button
                      id={`session-detail-vote-button-${game.id}`}
                      type="button"
                      className={selected ? "button selected-button" : "button primary"}
                      onClick={() => vote(game.id)}
                      disabled={!canVote || working === game.id}
                    >
                      {selected ? "Tu voto" : working === game.id ? "Guardando..." : "Votar"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Vote Results */}
      <section id="session-votes-section" className="detail-section" aria-labelledby="session-votes-title">
        <h3 id="session-votes-title">Votos ({data.results.totalVotes} emitidos)</h3>
        {votesByGame.length > 0 ? (
          <div id="session-vote-breakdown" className="vote-breakdown">
            {votesByGame.map((item) => (
              <div id={`session-vote-breakdown-${item.gameId}`} className="vote-breakdown-row" key={item.gameId}>
                <img
                  id={`session-vote-breakdown-image-${item.gameId}`}
                  src={item.thumbnailUrl ?? "/placeholder-game.svg"}
                  alt=""
                  className="vote-breakdown-thumb"
                  loading="lazy"
                />
                <div className="vote-breakdown-info">
                  <Link id={`session-vote-game-link-${item.gameId}`} href={`/games/${item.gameId}`} className="game-link">
                    <strong>{item.gameName}</strong>
                  </Link>
                  <span className="vote-count">{item.votes} {item.votes === 1 ? "voto" : "votos"}</span>
                  <div id={`session-voter-list-${item.gameId}`} className="voter-list">
                    {item.voters.map((voter, i) => (
                      <span key={i} className="voter-chip">
                        {voter.image ? (
                          <img src={voter.image} alt="" className="voter-avatar" />
                        ) : null}
                        {voter.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p id="session-vote-breakdown-empty" className="status-line">Aún no hay votos en esta sesión.</p>
        )}
      </section>

      {/* Notes */}
      <section id="session-notes-section" className="detail-section" aria-labelledby="session-notes-title">
        <div id="session-notes-header" className="detail-section-header">
          <h3 id="session-notes-title">Notas</h3>
          {canEditNotes && !editingNotes ? (
            <button
              id="edit-session-notes-button"
              type="button"
              className="tiny-button"
              onClick={() => {
                setNotesText(data.session.notes ?? "");
                setEditingNotes(true);
              }}
            >
              Editar
            </button>
          ) : null}
        </div>
        {editingNotes ? (
          <div id="session-notes-editor" className="notes-edit">
            <textarea
              id="session-notes-textarea"
              name="session-notes"
              aria-labelledby="session-notes-title"
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              rows={4}
              className="notes-textarea"
            />
            <div id="session-notes-actions" className="notes-actions">
              <button
                id="save-session-notes-button"
                type="button"
                className="button primary"
                onClick={saveNotes}
                disabled={savingNotes}
              >
                {savingNotes ? "Guardando..." : "Guardar"}
              </button>
              <button
                id="cancel-session-notes-button"
                type="button"
                className="button secondary"
                onClick={() => setEditingNotes(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <p id="session-notes-content" className="status-line">{data.session.notes || "Sin notas."}</p>
        )}
      </section>

      {/* Location */}
      <section id="session-location-section" className="detail-section" aria-labelledby="session-location-title">
        <h3 id="session-location-title">Lugar</h3>
        <div id="session-location-picker" className="location-picker">
          <select
            id="session-location-select"
            name="session-location"
            aria-labelledby="session-location-title"
            value={selectedLocationId}
            onChange={(e) => setSelectedLocationId(e.target.value)}
          >
            <option value="">Sin lugar asignado</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} — {loc.address}
              </option>
            ))}
          </select>
          <button
            id="save-session-location-button"
            type="button"
            className="button primary"
            onClick={saveLocation}
            disabled={savingLocation || selectedLocationId === (data.session.location?.id ?? "")}
          >
            {savingLocation ? "Guardando..." : "Cambiar"}
          </button>
          <button
            id="toggle-new-location-form-button"
            type="button"
            className="tiny-button"
            onClick={() => setShowNewLocationForm(!showNewLocationForm)}
          >
            {showNewLocationForm ? "Cancelar" : "Nuevo lugar"}
          </button>
        </div>
        {showNewLocationForm ? (
          <div id="new-location-form" className="new-location-form">
            <input
              id="new-location-name-input"
              name="new-location-name"
              placeholder="Nombre (ej. Casa de Juan)"
              value={newLocationName}
              onChange={(e) => setNewLocationName(e.target.value)}
            />
            <PlacesAddressInput
              id="new-location-address-input"
              name="new-location-address"
              placeholder="Dirección"
              value={newLocationAddress}
              onChange={setNewLocationAddress}
              onPlaceSelected={(place) => {
                setNewLocationAddress(place.address);
                setNewLocationName((current) => current.trim() || place.name);
              }}
            />
            <button
              id="create-location-button"
              type="button"
              className="button primary"
              onClick={createNewLocation}
              disabled={creatingLocation || !newLocationName.trim() || !newLocationAddress.trim()}
            >
              {creatingLocation ? "Creando..." : "Crear lugar"}
            </button>
          </div>
        ) : null}
      </section>

      {/* Chat */}
      <section id="session-chat-section" className="detail-section chat-section" aria-labelledby="session-chat-title">
        <h3 id="session-chat-title">Tablero de mensajes</h3>
        <div id="session-message-list" className="message-list">
          {messages.length === 0 ? (
            <p id="session-message-empty-state" className="status-line">No hay mensajes aún. Escribe el primero.</p>
          ) : (
            messages.map((msg) => (
              <div id={`session-message-${msg.id}`} key={msg.id} className={`message-row${msg.user.id === userId ? " own" : ""}`}>
                <div id={`session-message-meta-${msg.id}`} className="message-meta">
                  {msg.user.image ? (
                    <img src={msg.user.image} alt="" className="message-avatar" />
                  ) : null}
                  <strong>{msg.user.name ?? "Anónimo"}</strong>
                  <small>{formatMessageTime(msg.createdAt)}</small>
                </div>
                <p id={`session-message-content-${msg.id}`} className="message-content">{msg.content}</p>
              </div>
            ))
          )}
          <div id="session-messages-end" ref={messagesEndRef} />
        </div>
        <div id="session-chat-input" className="chat-input">
          <input
            id="session-chat-message-input"
            name="session-chat-message"
            type="text"
            placeholder="Escribe un mensaje..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage();
              }
            }}
            disabled={sendingMessage}
          />
          <button
            id="send-session-message-button"
            type="button"
            className="button primary"
            onClick={() => void sendMessage()}
            disabled={sendingMessage || !newMessage.trim()}
          >
            {sendingMessage ? "..." : "Enviar"}
          </button>
        </div>
      </section>
    </div>
  );
}

function formatMessageTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}
