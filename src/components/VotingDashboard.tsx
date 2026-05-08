"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Calendar } from "@/components/Calendar";
import { GameCurationPanel } from "@/components/GameCurationPanel";
import { GamePreferenceControl } from "@/components/GamePreferenceControl";
import { TimeInput } from "@/components/TimeInput";

type UserRole = "admin" | "user";
export type PreferenceState = "favorite" | "vetoed";
type SessionStatus = "draft" | "open" | "closed" | "cancelled";

export type Game = {
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
  preference: PreferenceState | null;
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

type LocationInfo = {
  id: string;
  name: string;
  address: string;
};

type CalendarSession = {
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
  currentVote: {
    gameId: string;
    gameName: string;
  } | null;
  results: VoteResults;
};

type SessionDetail = {
  session: CalendarSession;
  games: Game[];
  currentVote: {
    gameId: string;
    game: Game;
  } | null;
  results: VoteResults;
  curatedGameIds: string[];
  canCurateGames: boolean;
};

type SessionForm = {
  localDate: string;
  localStartTime: string;
  localEndTime: string;
  title: string;
  notes: string;
  status: SessionStatus;
  locationId: string;
};

type VotingDashboardProps = {
  userRole: UserRole;
};

const today = new Date().toISOString().slice(0, 10);

const emptySessionForm: SessionForm = {
  localDate: today,
  localStartTime: "",
  localEndTime: "",
  title: "",
  notes: "",
  status: "open",
  locationId: ""
};

export function formatSessionDateSpanish(localDate: string): string {
  const date = new Date(`${localDate}T12:00:00`);
  const formatted = date.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  const withoutComma = formatted.replace(",", "");
  return withoutComma.charAt(0).toUpperCase() + withoutComma.slice(1);
}

export function sessionDisplayTitle(session: { customTitle: string | null; localDate: string; title: string }): string {
  const customTitle = session.customTitle?.trim();

  if (customTitle) {
    return customTitle;
  }

  const title = session.title.trim();

  if (title && title !== `Vote for ${session.localDate}`) {
    return title;
  }

  return formatSessionDateSpanish(session.localDate);
}

export function VotingDashboard({ userRole }: VotingDashboardProps) {
  const [sessions, setSessions] = useState<CalendarSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(today);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [catalogGames, setCatalogGames] = useState<Game[]>([]);
  const [locations, setLocations] = useState<LocationInfo[]>([]);
  const [newSession, setNewSession] = useState<SessionForm>(emptySessionForm);
  const [editSession, setEditSession] = useState<SessionForm>(emptySessionForm);
  const [curatedIds, setCuratedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const isAdmin = userRole === "admin";

  // Filter sessions: today + future only
  const upcomingSessions = useMemo(
    () => sessions.filter((s) => s.localDate >= today),
    [sessions]
  );

  const nextSessions = useMemo(() => upcomingSessions.slice(0, 10), [upcomingSessions]);
  const sessionsForSelectedDate = useMemo(
    () => (selectedDate ? sessions.filter((session) => session.localDate === selectedDate) : []),
    [selectedDate, sessions]
  );
  const canCreateOnSelectedDate = !selectedDate || selectedDate >= today;

  async function loadCalendar(preferredSessionId?: string) {
    setLoading(true);
    setMessage(null);

    try {
      const from = shiftDate(today, -14);
      const to = shiftDate(today, 90);
      const response = await fetch(`/api/sessions?from=${from}&to=${to}`);

      if (!response.ok) {
        throw new Error("No se pudo cargar el calendario de sesiones.");
      }

      const body = (await response.json()) as { sessions: CalendarSession[] };
      setSessions(body.sessions);

      const nextSelectedId =
        preferredSessionId ??
        selectedSessionId ??
        body.sessions.find((session) => session.localDate === today && session.status === "open")?.id ??
        body.sessions.find((session) => session.localDate >= today && session.status === "open")?.id ??
        null;

      setSelectedSessionId(nextSelectedId);

      if (nextSelectedId) {
        const nextDetail = await loadSession(nextSelectedId);
        setSelectedDate(nextDetail.session.localDate);
      } else {
        setDetail(null);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Algo salió mal.");
    } finally {
      setLoading(false);
    }
  }

  async function loadSession(sessionId: string): Promise<SessionDetail> {
    const response = await fetch(`/api/sessions/${sessionId}`);

    if (!response.ok) {
      throw new Error("No se pudo cargar la sesión seleccionada.");
    }

    const nextDetail = (await response.json()) as SessionDetail;
    setDetail(nextDetail);
    setEditSession(formFromSession(nextDetail.session));
    setCuratedIds(nextDetail.curatedGameIds);
    return nextDetail;
  }

  async function loadCatalog() {
    const response = await fetch("/api/catalog");

    if (response.ok) {
      const body = (await response.json()) as { games: Game[] };
      setCatalogGames(body.games);
    }
  }

  async function loadLocations() {
    const response = await fetch("/api/locations");

    if (response.ok) {
      const body = (await response.json()) as { locations: LocationInfo[] };
      setLocations(body.locations);
    }
  }

  useEffect(() => {
    void loadCalendar();
    void loadCatalog();
    void loadLocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leaderText = useMemo(() => {
    if (!detail || detail.results.totalVotes === 0) {
      return "Sin votos aún";
    }

    if (detail.results.leaders.length === 1) {
      return `${detail.results.leaders[0].gameName} lidera`;
    }

    return `${detail.results.leaders.length} juegos empatados`;
  }, [detail]);

  function handleSelectDate(date: string) {
    setSelectedDate(date);
    setShowCreateForm(false);
    const sessionsOnDate = sessions.filter((s) => s.localDate === date);

    if (sessionsOnDate.length > 0) {
      const nextSession = sessionsOnDate.find((session) => session.status === "open") ?? sessionsOnDate[0];
      void selectSession(nextSession.id);
    } else if (date >= today) {
      setSelectedSessionId(null);
      setDetail(null);
      setNewSession({ ...emptySessionForm, localDate: date });
      setShowCreateForm(true);
    } else {
      setSelectedSessionId(null);
      setDetail(null);
    }
  }

  async function selectSession(sessionId: string) {
    setSelectedSessionId(sessionId);
    setWorking("session");
    setMessage(null);
    setShowCreateForm(false);

    try {
      const nextDetail = await loadSession(sessionId);
      setSelectedDate(nextDetail.session.localDate);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar la sesión.");
    } finally {
      setWorking(null);
    }
  }

  async function vote(gameId: string) {
    if (!detail) return;

    setWorking(gameId);
    setMessage(null);

    try {
      const response = await fetch(`/api/sessions/${detail.session.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "No se pudo guardar tu voto.");
      }

      setDetail((await response.json()) as SessionDetail);
      await loadCalendar(detail.session.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar tu voto.");
    } finally {
      setWorking(null);
    }
  }

  async function refreshCatalog() {
    setWorking("refresh");
    setMessage("Actualizando catálogo de BoardGameGeek.");

    try {
      const response = await fetch("/api/catalog/refresh", { method: "POST" });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Error al actualizar el catálogo.");
      }

      if (selectedSessionId) {
        await loadSession(selectedSessionId);
      }

      await loadCatalog();
      setMessage("Catálogo actualizado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error al actualizar el catálogo.");
    } finally {
      setWorking(null);
    }
  }

  async function setPreference(gameId: string, preference: PreferenceState | null) {
    setWorking(`${gameId}-${preference ?? "clear"}`);
    setMessage(null);

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

      if (selectedSessionId) {
        await loadSession(selectedSessionId);
      }

      await loadCatalog();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar la preferencia.");
    } finally {
      setWorking(null);
    }
  }

  async function createSession() {
    setWorking("create-session");
    setMessage(null);

    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formPayload(newSession))
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "No se pudo crear la sesión.");
      }

      const body = (await response.json()) as { session: { id: string } };
      setNewSession(emptySessionForm);
      setShowCreateForm(false);
      await loadCalendar(body.session.id);
      setMessage("Sesión creada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo crear la sesión.");
    } finally {
      setWorking(null);
    }
  }

  async function saveSession(nextStatus?: SessionStatus) {
    if (!detail) return;

    setWorking("save-session");
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/sessions/${detail.session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formPayload(editSession),
          status: nextStatus ?? editSession.status
        })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "No se pudo actualizar la sesión.");
      }

      await loadCalendar(detail.session.id);
      setMessage("Sesión actualizada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar la sesión.");
    } finally {
      setWorking(null);
    }
  }

  async function cancelSession() {
    if (!detail) return;

    setWorking("cancel-session");
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/sessions/${detail.session.id}/cancel`, {
        method: "POST"
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "No se pudo cancelar la sesión.");
      }

      await loadCalendar(detail.session.id);
      setMessage("Sesión cancelada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cancelar la sesión.");
    } finally {
      setWorking(null);
    }
  }

  async function saveCuratedGames() {
    if (!detail) return;

    setWorking("curate-games");
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/sessions/${detail.session.id}/games`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameIds: curatedIds })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "No se pudo actualizar la selección de juegos.");
      }

      await loadSession(detail.session.id);
      setMessage("Selección de juegos actualizada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar la selección de juegos.");
    } finally {
      setWorking(null);
    }
  }

  function renderSessionRow(session: CalendarSession, showDate: boolean, idPrefix: string) {
    return (
      <article
        id={`${idPrefix}-session-row-${session.id}`}
        className={`session-row${selectedSessionId === session.id ? " selected" : ""}`}
        key={session.id}
      >
        <button
          id={`${idPrefix}-select-session-${session.id}`}
          type="button"
          className="session-row-select"
          onClick={() => selectSession(session.id)}
          disabled={working === "session"}
        >
          <span>
            <strong>{sessionDisplayTitle(session)}</strong>
            {showDate ? (
              <small>
                {formatSessionDateSpanish(session.localDate)}
              </small>
            ) : null}
            <small>
              {formatSessionTime(session)}
              {session.location ? ` — ${session.location.name}` : ""}
            </small>
          </span>
          <span id={`${idPrefix}-session-status-${session.id}`} className={`status-pill ${session.status}`}>{session.status}</span>
          <small>{session.currentVote ? `Tu voto: ${session.currentVote.gameName}` : resultLabel(session.results)}</small>
        </button>
        <Link
          id={`${idPrefix}-session-detail-link-${session.id}`}
          href={`/sessions/${session.id}`}
          className="button secondary session-detail-link"
        >
          Ver detalle
        </Link>
      </article>
    );
  }

  if (loading && sessions.length === 0) {
    return <p id="voting-dashboard-loading" className="status-line">Cargando el calendario de sesiones.</p>;
  }

  return (
    <div id="voting-dashboard" className="dashboard calendar-dashboard">
      <section id="calendar-panel" className="calendar-panel" aria-labelledby="calendar-title">
        <div id="calendar-panel-heading" className="section-heading">
          <div>
            <p className="eyebrow">Calendario</p>
            <h2 id="calendar-title">Sesiones</h2>
          </div>
          {isAdmin ? (
            <button
              id="refresh-catalog-button"
              type="button"
              className="button secondary"
              onClick={refreshCatalog}
              disabled={working === "refresh"}
            >
              {working === "refresh" ? "Actualizando" : "Actualizar BGG"}
            </button>
          ) : null}
        </div>

        {message ? <p id="dashboard-status-message" className="status-line">{message}</p> : null}

        <Calendar sessions={sessions} selectedDate={selectedDate} onSelectDate={handleSelectDate} />

        <div id="selected-date-session-list" className="session-list selected-date-session-list">
          <h3 id="selected-date-session-list-title" className="session-list-title">
            {selectedDate ? formatSessionDateSpanish(selectedDate) : "Día seleccionado"}
          </h3>
          {sessionsForSelectedDate.map((session) => renderSessionRow(session, false, "selected-date"))}
          {sessionsForSelectedDate.length === 0 ? (
            <p className="status-line">
              {canCreateOnSelectedDate ? "No hay sesiones en este día." : "No hay sesiones visibles en este día."}
            </p>
          ) : null}
        </div>

        <div id="upcoming-session-list" className="session-list">
          <h3 id="upcoming-session-list-title" className="session-list-title">
            Próximas sesiones
          </h3>
          {nextSessions.map((session) => renderSessionRow(session, true, "upcoming"))}
          {nextSessions.length === 0 ? (
            <p className="status-line">No hay próximas sesiones.</p>
          ) : null}
        </div>

        <button
          id="open-create-session-button"
          type="button"
          className="button primary create-session-btn"
          onClick={() => {
            if (!canCreateOnSelectedDate) return;
            setNewSession({ ...emptySessionForm, localDate: selectedDate ?? today });
            setShowCreateForm(!showCreateForm);
          }}
          disabled={!canCreateOnSelectedDate}
        >
          {showCreateForm ? "Cancelar" : sessionsForSelectedDate.length > 0 ? "Crear otra sesión" : "Crear sesión"}
        </button>
      </section>

      {showCreateForm ? (
        <section id="create-session-workspace" className="create-session-workspace" aria-labelledby="new-session-title">
          <div id="create-session-heading" className="section-heading">
            <div>
              <p className="eyebrow">{selectedDate ? formatSessionDateSpanish(selectedDate) : "Nueva sesión"}</p>
              <h2 id="new-session-title">Crear sesión</h2>
              <p className="status-line">Define fecha, hora, lugar y notas sin pelearte con el scroll lateral.</p>
            </div>
          </div>
          <SessionFormFields idPrefix="new-session" form={newSession} onChange={setNewSession} locations={locations} />
          <div id="create-session-actions" className="create-session-actions">
            <button
              id="create-session-submit-button"
              type="button"
              className="button primary"
              onClick={createSession}
              disabled={working === "create-session"}
            >
              {working === "create-session" ? "Creando..." : "Crear sesión"}
            </button>
            <button
              id="create-session-cancel-button"
              type="button"
              className="button secondary"
              onClick={() => setShowCreateForm(false)}
            >
              Cancelar
            </button>
          </div>
        </section>
      ) : (
        <>
      <section id="vote-panel" className="vote-panel" aria-labelledby="session-title">
        {detail ? (
          <>
            <div id="vote-panel-heading" className="section-heading">
              <div>
                <p className="eyebrow">{formatSessionDateSpanish(detail.session.localDate)}</p>
                <h2 id="session-title">{sessionDisplayTitle(detail.session)}</h2>
                <p className="status-line">{formatSessionTime(detail.session)}</p>
                {detail.session.location ? (
                  <p className="status-line">{detail.session.location.name} — {detail.session.location.address}</p>
                ) : null}
                {detail.session.notes ? <p className="status-line">{detail.session.notes}</p> : null}
              </div>
              <div id="selected-session-actions" className="session-header-actions">
                <span id="selected-session-status" className={`status-pill ${detail.session.status}`}>{detail.session.status}</span>
                <Link id="selected-session-detail-link" href={`/sessions/${detail.session.id}`} className="button secondary">
                  Ver detalle
                </Link>
              </div>
            </div>

            {detail.games.length === 0 ? (
              <div id="vote-panel-empty-state" className="empty-state">
                <h3>No hay juegos disponibles para esta sesión.</h3>
                <p>Actualiza BoardGameGeek o pide a un admin que ajuste la lista de juegos.</p>
              </div>
            ) : null}

            <div id="voting-game-grid" className="game-grid">
              {detail.games.map((game) => {
                const selected = detail.currentVote?.gameId === game.id;
                const canVote = detail.session.status === "open";

                return (
                  <article
                    id={`vote-game-card-${game.id}`}
                    className={`game-card${selected ? " selected" : ""} ${game.preference ?? ""}`}
                    key={game.id}
                  >
                    <img
                      id={`vote-game-image-${game.id}`}
                      src={game.thumbnailUrl ?? game.imageUrl ?? "/placeholder-game.svg"}
                      alt=""
                      className="game-thumb"
                      loading="lazy"
                    />
                    <div className="game-copy">
                      <h3>
                        <Link id={`vote-game-link-${game.id}`} href={`/games/${game.id}`} className="game-link">
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
                        idPrefix={`vote-game-${game.id}`}
                        preference={game.preference}
                        onChange={(preference) => setPreference(game.id, preference)}
                        disabled={working?.startsWith(`${game.id}-`) ?? false}
                      />
                    </div>
                    <div className="card-actions">
                      <button
                        id={`vote-game-button-${game.id}`}
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
          </>
        ) : (
          <p id="vote-panel-empty-selection" className="status-line">Selecciona una sesión para votar.</p>
        )}
      </section>

      <aside id="results-panel" className="results-panel" aria-label="Resultados de votación">
        <div id="vote-result-summary" className="result-summary">
          <p className="eyebrow">Resultado actual</p>
          <h2 id="vote-result-leader">{leaderText}</h2>
          <p id="vote-result-total">{detail?.results.totalVotes ?? 0} votos emitidos</p>
        </div>

        <div id="vote-result-list" className="result-list">
          {detail?.results.items.map((item) => (
            <div id={`vote-result-row-${item.gameId}`} className="result-row" key={item.gameId}>
              <img src={item.thumbnailUrl ?? "/placeholder-game.svg"} alt="" loading="lazy" />
              <span>{item.gameName}</span>
              <strong>{item.votes}</strong>
            </div>
          ))}
          {detail && detail.results.items.length === 0 ? <p className="status-line">El primer voto aún está esperando.</p> : null}
        </div>

        {isAdmin && detail ? (
          <div id="session-admin-panel" className="admin-panel">
            <h2 id="session-admin-title">Admin de sesión</h2>
            <SessionFormFields idPrefix="admin-session" form={editSession} onChange={setEditSession} locations={locations} />
            <div id="session-admin-actions" className="admin-actions">
              <button
                id="save-session-button"
                type="button"
                className="button primary"
                onClick={() => saveSession()}
                disabled={working === "save-session"}
              >
                Guardar
              </button>
              <button
                id="close-session-button"
                type="button"
                className="button secondary"
                onClick={() => saveSession("closed")}
                disabled={working === "save-session"}
              >
                Cerrar
              </button>
              <button
                id="cancel-session-button"
                type="button"
                className="button secondary"
                onClick={cancelSession}
                disabled={working === "cancel-session"}
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : null}

        {detail?.canCurateGames ? (
          <div id="session-curation-panel" className="admin-panel">
            <GameCurationPanel
              idPrefix="dashboard-game-curation"
              games={catalogGames}
              selectedGameIds={curatedIds}
              onSelectedGameIdsChange={setCuratedIds}
              onSave={saveCuratedGames}
              saving={working === "curate-games"}
            />
          </div>
        ) : null}
      </aside>
        </>
      )}
    </div>
  );
}

function SessionFormFields({
  idPrefix,
  form,
  onChange,
  locations
}: {
  idPrefix: string;
  form: SessionForm;
  onChange: (form: SessionForm) => void;
  locations: LocationInfo[];
}) {
  const fieldId = (field: string) => `${idPrefix}-${field}`;

  return (
    <div id={`${idPrefix}-form`} className="session-form">
      <label htmlFor={fieldId("date")}>
        <span>Fecha</span>
        <input
          id={fieldId("date")}
          name={`${idPrefix}-date`}
          type="date"
          value={form.localDate}
          onChange={(event) => onChange({ ...form, localDate: event.target.value })}
        />
      </label>
      <label htmlFor={fieldId("start-time")}>
        <span>Inicio</span>
        <TimeInput
          id={fieldId("start-time")}
          name={`${idPrefix}-start-time`}
          value={form.localStartTime}
          onChange={(localStartTime) => onChange({ ...form, localStartTime })}
        />
      </label>
      <label htmlFor={fieldId("end-time")}>
        <span>Fin</span>
        <TimeInput
          id={fieldId("end-time")}
          name={`${idPrefix}-end-time`}
          value={form.localEndTime}
          onChange={(localEndTime) => onChange({ ...form, localEndTime })}
        />
      </label>
      <label htmlFor={fieldId("status")}>
        <span>Estado</span>
        <select
          id={fieldId("status")}
          name={`${idPrefix}-status`}
          value={form.status}
          onChange={(event) => onChange({ ...form, status: event.target.value as SessionStatus })}
        >
          <option value="draft">borrador</option>
          <option value="open">abierta</option>
          <option value="closed">cerrada</option>
          <option value="cancelled">cancelada</option>
        </select>
      </label>
      <label className="wide-field" htmlFor={fieldId("location")}>
        <span>Lugar</span>
        <select
          id={fieldId("location")}
          name={`${idPrefix}-location`}
          value={form.locationId}
          onChange={(event) => onChange({ ...form, locationId: event.target.value })}
        >
          <option value="">Sin lugar asignado</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name} — {loc.address}
            </option>
          ))}
        </select>
      </label>
      <label className="wide-field" htmlFor={fieldId("title")}>
        <span>Título</span>
        <input
          id={fieldId("title")}
          name={`${idPrefix}-title`}
          value={form.title}
          onChange={(event) => onChange({ ...form, title: event.target.value })}
        />
      </label>
      <label className="wide-field" htmlFor={fieldId("notes")}>
        <span>Notas</span>
        <textarea
          id={fieldId("notes")}
          name={`${idPrefix}-notes`}
          value={form.notes}
          rows={3}
          onChange={(event) => onChange({ ...form, notes: event.target.value })}
        />
      </label>
    </div>
  );
}

function formFromSession(session: CalendarSession): SessionForm {
  return {
    localDate: session.localDate,
    localStartTime: session.localStartTime ?? "",
    localEndTime: session.localEndTime ?? "",
    title: session.customTitle ?? "",
    notes: session.notes ?? "",
    status: session.status,
    locationId: session.location?.id ?? ""
  };
}

function formPayload(form: SessionForm) {
  return {
    localDate: form.localDate,
    localStartTime: form.localStartTime || null,
    localEndTime: form.localEndTime || null,
    title: form.title || null,
    notes: form.notes || null,
    status: form.status,
    locationId: form.locationId || null
  };
}

function shiftDate(localDate: string, days: number): string {
  const date = new Date(`${localDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatSessionTime(session: { localStartTime: string | null; localEndTime: string | null }): string {
  if (!session.localStartTime) {
    return "Sin hora definida";
  }

  return `${session.localStartTime}${session.localEndTime ? `–${session.localEndTime}` : ""}`;
}

function resultLabel(results: VoteResults): string {
  if (results.totalVotes === 0) {
    return "Sin votos";
  }

  if (results.leaders.length === 1) {
    return `${results.leaders[0].gameName} lidera`;
  }

  return `${results.leaders.length} empatados`;
}

export function playersLabel(game: Pick<Game, "minPlayers" | "maxPlayers">): string {
  if (game.minPlayers && game.maxPlayers && game.minPlayers !== game.maxPlayers) {
    return `${game.minPlayers}–${game.maxPlayers} jugadores`;
  }

  if (game.minPlayers || game.maxPlayers) {
    return `${game.minPlayers ?? game.maxPlayers} jugadores`;
  }

  return "Jugadores desconocido";
}

export function preferenceLabel(preference: PreferenceState | null): string {
  if (preference === "favorite") {
    return "Favorito";
  }

  if (preference === "vetoed") {
    return "Vetado";
  }

  return "";
}
