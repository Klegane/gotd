"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";

import { Calendar } from "@/components/Calendar";
import { GameCurationPanel } from "@/components/GameCurationPanel";
import { GamePickerDropdown } from "@/components/GamePickerDropdown";
import { GamePreferenceControl } from "@/components/GamePreferenceControl";
import { TimeInput } from "@/components/TimeInput";

type UserRole = "admin" | "user";
export type PreferenceState = "favorite" | "vetoed";
export type SessionStatus = "draft" | "open" | "closed" | "cancelled";

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
  categories: string[];
  mechanisms: string[];
  families: string[];
  designers: string[];
  artists: string[];
  preference: PreferenceState | null;
  optionSource?: string | null;
  isCreatorOption?: boolean;
  proposalCount?: number;
  proposedByCurrentUser?: boolean;
  priorityProposalByCurrentUser?: boolean;
  proposers?: string[];
};

type VoteResult = {
  gameId: string;
  gameName: string;
  thumbnailUrl: string | null;
  votes: number;
  normalVotes?: number;
  bidPoints?: number;
  vetoCount?: number;
  vetoPenalty?: number;
  score?: number;
};

type VoteResults = {
  totalVotes: number;
  totalNormalVotes?: number;
  totalBidPoints?: number;
  totalVetoPenalty?: number;
  leaders: VoteResult[];
  items: VoteResult[];
};

export type BallotAllocation = {
  gameId: string;
  gameName?: string;
  voteCount: number;
  game?: {
    name: string;
  };
};

type CurrentBallot = {
  allocations: BallotAllocation[];
  pointBid?: {
    gameId: string;
    points: number;
    gameName?: string;
    game?: {
      name: string;
    };
  } | null;
};

type BallotLimits = {
  eligibleGameCount: number;
  maxVotes: number;
  canMultiVote: boolean;
};

type SessionProposal = {
  id: string;
  gameId: string;
  userId: string;
  isPriority: boolean;
  game: {
    id: string;
    name: string;
  };
};

export type SessionParticipant = {
  id: string;
  votingSessionId: string;
  userId: string;
  userName: string;
  userImage: string | null;
  invitedByUserId: string | null;
  invitedByName: string | null;
  status: string;
  invitedAt: string;
  respondedAt: string | null;
  attendanceUpdatedAt: string | null;
};

export type RegisteredUser = {
  id: string;
  displayName: string;
  nickname: string | null;
  name: string | null;
  email: string | null;
  image: string | null;
};

export type LocationInfo = {
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
  allowPlayerProposals: boolean;
  playedGameId: string | null;
  pointsSettledAt: string | null;
  currentVote: {
    gameId: string;
    gameName: string;
  } | null;
  currentBallot: CurrentBallot | null;
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
  proposals: SessionProposal[];
  priorityProposal: SessionProposal | null;
  currentBallot: CurrentBallot | null;
  ballotLimits: BallotLimits;
  priorityPointBalance: number;
  availablePriorityPoints: number;
  canProposeGames: boolean;
  canCurateGames: boolean;
  canSettlePoints: boolean;
  closedProposalControlCost: number;
  participants: SessionParticipant[];
  currentParticipant: SessionParticipant | null;
};

export type SessionForm = {
  localDate: string;
  localStartTime: string;
  localEndTime: string;
  title: string;
  notes: string;
  status: SessionStatus;
  locationId: string;
  allowPlayerProposals: boolean;
  invitedUserIds: string[];
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
  locationId: "",
  allowPlayerProposals: true,
  invitedUserIds: []
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
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [newSession, setNewSession] = useState<SessionForm>(emptySessionForm);
  const [editSession, setEditSession] = useState<SessionForm>(emptySessionForm);
  const [curatedIds, setCuratedIds] = useState<string[]>([]);
  const [proposalGameId, setProposalGameId] = useState("");
  const [bidInputs, setBidInputs] = useState<Record<string, string>>({});
  const [settlementGameId, setSettlementGameId] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

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

  async function loadCalendar(preferredSessionId?: string | null) {
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

      const preferredSessionExists = preferredSessionId ? body.sessions.some((session) => session.id === preferredSessionId) : false;
      const selectedSessionExists = selectedSessionId ? body.sessions.some((session) => session.id === selectedSessionId) : false;
      const nextSelectedId =
        (preferredSessionExists ? preferredSessionId : null) ??
        (selectedSessionExists ? selectedSessionId : null) ??
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
    setEditSession({
      ...formFromSession(nextDetail.session),
      invitedUserIds: nextDetail.participants.map((participant) => participant.userId)
    });
    setCuratedIds(nextDetail.curatedGameIds);
    setProposalGameId((current) => (current && nextDetail.games.some((game) => game.id === current) ? current : nextDetail.games[0]?.id ?? ""));
    setSettlementGameId(nextDetail.session.playedGameId ?? nextDetail.results.leaders[0]?.gameId ?? nextDetail.games[0]?.id ?? "");
    setBidInputs((current) => ({
      ...current,
      ...(nextDetail.currentBallot?.pointBid
        ? { [nextDetail.currentBallot.pointBid.gameId]: String(nextDetail.currentBallot.pointBid.points) }
        : {})
    }));
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

  async function loadUsers() {
    const response = await fetch("/api/users");

    if (response.ok) {
      const body = (await response.json()) as { users: RegisteredUser[] };
      setUsers(body.users);
    }
  }

  useEffect(() => {
    void loadCalendar();
    void loadCatalog();
    void loadLocations();
    void loadUsers();
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
  const proposalGameIsAvailable = catalogGames.some((game) => game.id === proposalGameId);

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
    setShowDeleteDialog(false);
    setDeleteConfirmation("");

    try {
      const nextDetail = await loadSession(sessionId);
      setSelectedDate(nextDetail.session.localDate);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar la sesión.");
    } finally {
      setWorking(null);
    }
  }

  async function updateBallot(gameId: string, delta: number) {
    if (!detail) return;

    const allocations = nextBallotAllocations(detail.currentBallot?.allocations ?? [], gameId, delta, detail.ballotLimits);

    if (!allocations) {
      setMessage("No puedes votar a todos los juegos disponibles ni superar tu capacidad de voto.");
      return;
    }

    if (allocations.length === 0) {
      setMessage("La papeleta debe mantener al menos un voto.");
      return;
    }

    setWorking(`ballot-${gameId}`);
    setMessage(null);

    try {
      const response = await fetch(`/api/sessions/${detail.session.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allocations })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "No se pudo guardar tu voto.");
      }

      setDetail((await response.json()) as SessionDetail);
      await loadCalendar(detail.session.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar tu papeleta.");
    } finally {
      setWorking(null);
    }
  }

  async function proposeGame(isPriority = false) {
    if (!detail || !proposalGameId) return;

    setWorking(isPriority ? "priority-proposal" : "proposal");
    setMessage(null);

    try {
      const response = await fetch(`/api/sessions/${detail.session.id}/proposals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: proposalGameId, isPriority })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "No se pudo proponer el juego.");
      }

      await loadSession(detail.session.id);
      await loadCalendar(detail.session.id);
      setMessage(isPriority ? "Propuesta prioritaria guardada." : "Juego propuesto.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo proponer el juego.");
    } finally {
      setWorking(null);
    }
  }

  async function setPriorityProposal(gameId: string) {
    if (!detail) return;

    setWorking(`priority-${gameId}`);
    setMessage(null);

    try {
      const response = await fetch(`/api/sessions/${detail.session.id}/priority`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "No se pudo marcar la prioridad.");
      }

      await loadSession(detail.session.id);
      setMessage("Prioridad actualizada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo marcar la prioridad.");
    } finally {
      setWorking(null);
    }
  }

  async function submitPointBid(gameId: string) {
    if (!detail) return;

    const points = Number(bidInputs[gameId] ?? "0");
    setWorking(`bid-${gameId}`);
    setMessage(null);

    try {
      const response = await fetch(`/api/sessions/${detail.session.id}/priority`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, points })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "No se pudo apostar puntos.");
      }

      setDetail((await response.json()) as SessionDetail);
      await loadCalendar(detail.session.id);
      setMessage("Apuesta de puntos guardada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo apostar puntos.");
    } finally {
      setWorking(null);
    }
  }

  async function settlePlayedGame() {
    if (!detail || !settlementGameId) return;

    setWorking("settle-points");
    setMessage(null);

    try {
      const response = await fetch(`/api/sessions/${detail.session.id}/settlement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playedGameId: settlementGameId })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "No se pudo cerrar el juego jugado.");
      }

      setDetail((await response.json()) as SessionDetail);
      await loadCalendar(detail.session.id);
      setMessage("Juego jugado registrado y puntos asentados.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cerrar el juego jugado.");
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

  async function respondToInvitation(status: "accepted" | "declined" | "maybe") {
    if (!detail) return;

    setWorking(`participant-response-${status}`);
    setMessage(null);

    try {
      const response = await fetch(`/api/sessions/${detail.session.id}/participants/response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "No se pudo guardar tu respuesta.");
      }

      await loadSession(detail.session.id);
      setMessage("Respuesta guardada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar tu respuesta.");
    } finally {
      setWorking(null);
    }
  }

  async function markAttendance(userId: string, status: "attended" | "absent") {
    if (!detail) return;

    setWorking(`attendance-${userId}-${status}`);
    setMessage(null);

    try {
      const response = await fetch(`/api/sessions/${detail.session.id}/participants/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, status })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "No se pudo guardar asistencia.");
      }

      await loadSession(detail.session.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar asistencia.");
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

  async function deleteSession() {
    if (!detail || deleteConfirmation !== "BORRAR") return;

    const deletedTitle = sessionDisplayTitle(detail.session);
    setWorking("delete-session");
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/sessions/${detail.session.id}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "No se pudo borrar la sesión.");
      }

      setShowDeleteDialog(false);
      setDeleteConfirmation("");
      setSelectedSessionId(null);
      setDetail(null);
      await loadCalendar(null);
      setMessage(`Sesión borrada: ${deletedTitle}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo borrar la sesión.");
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
          <small>{session.currentBallot?.allocations.length ? `Tu papeleta: ${ballotSummary(session.currentBallot)}` : resultLabel(session.results)}</small>
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
          <SessionFormFields
            idPrefix="new-session"
            form={newSession}
            onChange={setNewSession}
            locations={locations}
            users={users}
            closedProposalCost={newSession.allowPlayerProposals ? 0 : 6}
          />
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
                <p id="selected-session-proposal-policy" className="status-line">
                  {detail.session.allowPlayerProposals ? "Propuestas de jugadores abiertas" : "Propuestas cerradas por el creador"}
                </p>
                <p id="selected-session-ballot-summary" className="status-line">
                  {detail.currentBallot?.allocations.length
                    ? `Tu papeleta: ${ballotSummary(detail.currentBallot)}`
                    : "Aún no has enviado papeleta."}
                </p>
              </div>
              <div id="selected-session-actions" className="session-header-actions">
                <span id="selected-session-status" className={`status-pill ${detail.session.status}`}>{detail.session.status}</span>
                <Link id="selected-session-detail-link" href={`/sessions/${detail.session.id}`} className="button secondary">
                  Ver detalle
                </Link>
              </div>
            </div>

            <SessionParticipantsPanel
              idPrefix="dashboard-participants"
              participants={detail.participants}
              users={users}
              canManage={detail.canCurateGames || isAdmin}
              currentParticipant={detail.currentParticipant}
              onRespond={respondToInvitation}
              onMarkAttendance={markAttendance}
              working={working}
            />

            {detail.canProposeGames ? (
              <div id="dashboard-proposal-controls" className="proposal-controls">
                <GamePickerDropdown
                  id="dashboard-proposal-game-select"
                  name="dashboard-proposal-game"
                  label="Proponer juego"
                  games={catalogGames}
                  value={proposalGameId}
                  onChange={setProposalGameId}
                  emptyText="No hay juegos en el catalogo"
                />
                <button
                  id="dashboard-submit-proposal-button"
                  type="button"
                  className="button secondary"
                  onClick={() => proposeGame(false)}
                  disabled={!proposalGameIsAvailable || working === "proposal"}
                >
                  {working === "proposal" ? "Proponiendo..." : "Proponer"}
                </button>
                <button
                  id="dashboard-submit-priority-proposal-button"
                  type="button"
                  className="button primary"
                  onClick={() => proposeGame(true)}
                  disabled={!proposalGameIsAvailable || working === "priority-proposal"}
                >
                  Prioridad
                </button>
              </div>
            ) : null}

            {detail.games.length === 0 ? (
              <div id="vote-panel-empty-state" className="empty-state">
                <h3>No hay juegos disponibles para esta sesión.</h3>
                <p>Actualiza BoardGameGeek o pide a un admin que ajuste la lista de juegos.</p>
              </div>
            ) : null}

            {detail.games.length > 0 ? (
              <p id="dashboard-ballot-capacity" className="status-line">
                Puedes repartir hasta {detail.ballotLimits.maxVotes} {detail.ballotLimits.maxVotes === 1 ? "voto" : "votos"}
                {detail.ballotLimits.canMultiVote ? "; no se puede votar a todos los juegos disponibles." : "."}
                {" "}Te quedan {remainingBallotVotes(detail.currentBallot, detail.ballotLimits)}.
              </p>
            ) : null}

            <div id="voting-game-grid" className="game-grid">
              {detail.games.map((game) => {
                const voteCount = allocationCount(detail.currentBallot, game.id);
                const selected = voteCount > 0;
                const canVote = detail.session.status === "open";
                const remainingVotes = remainingBallotVotes(detail.currentBallot, detail.ballotLimits);
                const canAddVote = canVote && remainingVotes > 0;
                const canBid = game.priorityProposalByCurrentUser && detail.session.status === "open";

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
                      {game.isCreatorOption ? <p className="status-line">Opción del creador</p> : null}
                      {game.proposalCount ? (
                        <p className="status-line">
                          Propuesto {game.proposalCount} {game.proposalCount === 1 ? "vez" : "veces"}
                        </p>
                      ) : null}
                      <GamePreferenceControl
                        idPrefix={`vote-game-${game.id}`}
                        preference={game.preference}
                        onChange={(preference) => setPreference(game.id, preference)}
                        disabled={working?.startsWith(`${game.id}-`) ?? false}
                      />
                    </div>
                    <div className="card-actions ballot-actions">
                      <span id={`vote-game-allocation-${game.id}`} className="vote-count">
                        {voteCount} {voteCount === 1 ? "voto" : "votos"}
                      </span>
                      <button
                        id={`vote-game-add-vote-${game.id}`}
                        type="button"
                        className={selected ? "button selected-button" : "button primary"}
                        onClick={() => updateBallot(game.id, 1)}
                        disabled={!canAddVote || working === `ballot-${game.id}`}
                      >
                        {working === `ballot-${game.id}` ? "Guardando..." : selected ? "+1 voto" : "Votar"}
                      </button>
                      {voteCount > 0 ? (
                        <button
                          id={`vote-game-remove-vote-${game.id}`}
                          type="button"
                          className="tiny-button"
                          onClick={() => updateBallot(game.id, -1)}
                          disabled={!canVote || working === `ballot-${game.id}`}
                        >
                          -1 voto
                        </button>
                      ) : null}
                      {game.proposedByCurrentUser ? (
                        <button
                          id={`vote-game-priority-${game.id}`}
                          type="button"
                          className="tiny-button"
                          onClick={() => setPriorityProposal(game.id)}
                          disabled={working === `priority-${game.id}` || game.priorityProposalByCurrentUser}
                        >
                          {game.priorityProposalByCurrentUser ? "Prioridad activa" : "Marcar prioridad"}
                        </button>
                      ) : null}
                      {canBid ? (
                        <div id={`vote-game-bid-controls-${game.id}`} className="bid-controls">
                          <label htmlFor={`vote-game-bid-input-${game.id}`}>
                            <span>Puntos</span>
                            <input
                              id={`vote-game-bid-input-${game.id}`}
                              name={`vote-game-bid-${game.id}`}
                              type="number"
                              min={0}
                              max={detail.availablePriorityPoints}
                              value={bidInputs[game.id] ?? ""}
                              onChange={(event) => setBidInputs((current) => ({ ...current, [game.id]: event.target.value }))}
                            />
                          </label>
                          <button
                            id={`vote-game-bid-submit-${game.id}`}
                            type="button"
                            className="tiny-button"
                            onClick={() => submitPointBid(game.id)}
                            disabled={working === `bid-${game.id}`}
                          >
                            Apostar
                          </button>
                        </div>
                      ) : null}
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
          <p id="vote-result-total">
            {detail?.results.totalNormalVotes ?? detail?.results.totalVotes ?? 0} votos, {detail?.results.totalBidPoints ?? 0} puntos, -{detail?.results.totalVetoPenalty ?? 0} por vetos
          </p>
          {detail ? (
            <p id="vote-result-points-balance">Tus puntos: {detail.priorityPointBalance} disponibles: {detail.availablePriorityPoints}</p>
          ) : null}
        </div>

        <div id="vote-result-list" className="result-list">
          {detail?.results.items.map((item) => (
            <div id={`vote-result-row-${item.gameId}`} className="result-row" key={item.gameId}>
              <img src={item.thumbnailUrl ?? "/placeholder-game.svg"} alt="" loading="lazy" />
              <span>{item.gameName}</span>
              <strong>{item.score ?? item.votes}</strong>
              <small>
                {item.normalVotes ?? item.votes} votos + {item.bidPoints ?? 0} pts - {item.vetoPenalty ?? 0} veto
                {(item.vetoCount ?? 0) === 1 ? "" : "s"}
              </small>
            </div>
          ))}
          {detail && detail.results.items.length === 0 ? <p className="status-line">El primer voto aún está esperando.</p> : null}
        </div>

        {isAdmin && detail ? (
          <div id="session-admin-panel" className="admin-panel">
            <h2 id="session-admin-title">Admin de sesión</h2>
            <SessionFormFields
              idPrefix="admin-session"
              form={editSession}
              onChange={setEditSession}
              locations={locations}
              users={users}
              closedProposalCost={editSession.allowPlayerProposals ? 0 : detail.closedProposalControlCost}
            />
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
              <button
                id="open-delete-session-dialog-button"
                type="button"
                className="button danger"
                onClick={() => {
                  setDeleteConfirmation("");
                  setShowDeleteDialog(true);
                }}
                disabled={working === "delete-session"}
              >
                Borrar
              </button>
            </div>
            {detail.canSettlePoints ? (
              <div id="dashboard-settlement-controls" className="settlement-controls">
                <label htmlFor="dashboard-played-game-select">
                  <span>Juego jugado</span>
                  <select
                    id="dashboard-played-game-select"
                    name="dashboard-played-game"
                    value={settlementGameId}
                    onChange={(event) => setSettlementGameId(event.target.value)}
                  >
                    {detail.games.map((game) => (
                      <option key={game.id} value={game.id}>
                        {game.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  id="dashboard-settle-points-button"
                  type="button"
                  className="button primary"
                  onClick={settlePlayedGame}
                  disabled={!settlementGameId || working === "settle-points"}
                >
                  {detail.session.pointsSettledAt ? "Revisar cierre" : "Registrar y asentar"}
                </button>
              </div>
            ) : null}
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
      {showDeleteDialog && detail ? (
        <div id="delete-session-dialog-backdrop" className="modal-backdrop">
          <section
            id="delete-session-dialog"
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-session-dialog-title"
            aria-describedby="delete-session-dialog-description"
          >
            <h2 id="delete-session-dialog-title">Borrar sesión</h2>
            <p id="delete-session-dialog-description">
              Esta acción borra definitivamente {sessionDisplayTitle(detail.session)} y todos sus votos, propuestas y mensajes.
            </p>
            <label htmlFor="delete-session-confirmation-input">
              <span>Escribe BORRAR para confirmar</span>
              <input
                id="delete-session-confirmation-input"
                name="delete-session-confirmation"
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                autoFocus
              />
            </label>
            <div className="confirm-dialog-actions">
              <button
                id="cancel-delete-session-button"
                type="button"
                className="button secondary"
                onClick={() => {
                  setShowDeleteDialog(false);
                  setDeleteConfirmation("");
                }}
                disabled={working === "delete-session"}
              >
                Conservar
              </button>
              <button
                id="confirm-delete-session-button"
                type="button"
                className="button danger"
                onClick={deleteSession}
                disabled={working === "delete-session" || deleteConfirmation !== "BORRAR"}
              >
                {working === "delete-session" ? "Borrando..." : "Borrar definitivamente"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

export function SessionFormFields({
  idPrefix,
  form,
  onChange,
  locations,
  users = [],
  closedProposalCost = 0
}: {
  idPrefix: string;
  form: SessionForm;
  onChange: (form: SessionForm) => void;
  locations: LocationInfo[];
  users?: RegisteredUser[];
  closedProposalCost?: number;
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
      <label className="wide-field" htmlFor={fieldId("proposal-policy")}>
        <span>Propuestas de juegos</span>
        <select
          id={fieldId("proposal-policy")}
          name={`${idPrefix}-proposal-policy`}
          value={form.allowPlayerProposals ? "open" : "closed"}
          onChange={(event) => onChange({ ...form, allowPlayerProposals: event.target.value === "open" })}
        >
          <option value="open">Abiertas a jugadores</option>
          <option value="closed">Cerradas por el creador</option>
        </select>
      </label>
      {!form.allowPlayerProposals ? (
        <p id={fieldId("proposal-cost")} className="wide-field status-line">
          Coste de control de propuestas: {closedProposalCost} puntos.
        </p>
      ) : null}
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
      {users.length > 0 ? (
        <fieldset id={fieldId("invites")} className="wide-field invite-fieldset">
          <legend>Invitados</legend>
          <div className="invite-checklist">
            {users.map((user) => {
              const selected = form.invitedUserIds.includes(user.id);

              return (
                <label key={user.id} htmlFor={`${fieldId("invite")}-${user.id}`} className="check-row">
                  <input
                    id={`${fieldId("invite")}-${user.id}`}
                    name={`${idPrefix}-invite-${user.id}`}
                    type="checkbox"
                    checked={selected}
                    onChange={(event) => {
                      const invitedUserIds = event.target.checked
                        ? [...form.invitedUserIds, user.id]
                        : form.invitedUserIds.filter((userId) => userId !== user.id);
                      onChange({ ...form, invitedUserIds });
                    }}
                  />
                  <span>{user.displayName}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}
    </div>
  );
}

export function SessionParticipantsPanel({
  idPrefix,
  participants = [],
  users = [],
  canManage,
  currentParticipant,
  onRespond,
  onMarkAttendance,
  working
}: {
  idPrefix: string;
  participants: SessionParticipant[];
  users: RegisteredUser[];
  canManage: boolean;
  currentParticipant: SessionParticipant | null;
  onRespond: (status: "accepted" | "declined" | "maybe") => void;
  onMarkAttendance: (userId: string, status: "attended" | "absent") => void;
  working: string | null;
}) {
  const invitedIds = new Set(participants.map((participant) => participant.userId));
  const uninvitedUsers = users.filter((user) => !invitedIds.has(user.id));

  return (
    <section id={`${idPrefix}-panel`} className="participants-panel" aria-label="Participantes">
      <div className="participants-header">
        <div>
          <p className="eyebrow">Participantes</p>
          <h3>{participants.length} invitados</h3>
        </div>
        {currentParticipant ? (
          <div className="participant-response-actions">
            <button
              id={`${idPrefix}-accept-button`}
              type="button"
              className="tiny-button"
              onClick={() => onRespond("accepted")}
              disabled={working === "participant-response-accepted"}
            >
              Voy
            </button>
            <button
              id={`${idPrefix}-maybe-button`}
              type="button"
              className="tiny-button"
              onClick={() => onRespond("maybe")}
              disabled={working === "participant-response-maybe"}
            >
              Quizas
            </button>
            <button
              id={`${idPrefix}-decline-button`}
              type="button"
              className="tiny-button"
              onClick={() => onRespond("declined")}
              disabled={working === "participant-response-declined"}
            >
              No voy
            </button>
          </div>
        ) : null}
      </div>
      {participants.length > 0 ? (
        <div className="participant-list">
          {participants.map((participant) => (
            <div id={`${idPrefix}-participant-${participant.userId}`} className="participant-row" key={participant.userId}>
              {participant.userImage ? <img src={participant.userImage} alt="" className="voter-avatar" /> : null}
              <span>{participant.userName}</span>
              <strong>{participant.status}</strong>
              {canManage ? (
                <span className="participant-admin-actions">
                  <button
                    type="button"
                    className="tiny-button"
                    onClick={() => onMarkAttendance(participant.userId, "attended")}
                    disabled={working === `attendance-${participant.userId}-attended`}
                  >
                    Jugó
                  </button>
                  <button
                    type="button"
                    className="tiny-button"
                    onClick={() => onMarkAttendance(participant.userId, "absent")}
                    disabled={working === `attendance-${participant.userId}-absent`}
                  >
                    Ausente
                  </button>
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="status-line">Aun no hay invitados concretos.</p>
      )}
      {canManage && uninvitedUsers.length > 0 ? (
        <p className="status-line">Puedes agregar invitados desde el formulario de sesion.</p>
      ) : null}
    </section>
  );
}

export function formFromSession(session: {
  localDate: string;
  localStartTime: string | null;
  localEndTime: string | null;
  customTitle: string | null;
  notes: string | null;
  status: SessionStatus;
  location: LocationInfo | null;
  allowPlayerProposals: boolean;
}): SessionForm {
  return {
    localDate: session.localDate,
    localStartTime: session.localStartTime ?? "",
    localEndTime: session.localEndTime ?? "",
    title: session.customTitle ?? "",
    notes: session.notes ?? "",
    status: session.status,
    locationId: session.location?.id ?? "",
    allowPlayerProposals: session.allowPlayerProposals,
    invitedUserIds: []
  };
}

export function formPayload(form: SessionForm) {
  return {
    localDate: form.localDate,
    localStartTime: form.localStartTime || null,
    localEndTime: form.localEndTime || null,
    title: form.title || null,
    notes: form.notes || null,
    status: form.status,
    locationId: form.locationId || null,
    allowPlayerProposals: form.allowPlayerProposals,
    invitedUserIds: form.invitedUserIds
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

function ballotSummary(ballot: CurrentBallot): string {
  const votes = ballot.allocations.map((allocation) => `${ballotAllocationName(allocation)} x${allocation.voteCount}`).join(", ");
  const bid =
    ballot.pointBid && ballot.pointBid.points > 0 ? `; ${ballot.pointBid.points} pts a ${ballotPointBidName(ballot.pointBid)}` : "";
  return `${votes}${bid}`;
}

function ballotAllocationName(allocation: BallotAllocation): string {
  return allocation.gameName ?? allocation.game?.name ?? "Juego";
}

function ballotPointBidName(pointBid: NonNullable<CurrentBallot["pointBid"]>): string {
  return pointBid.gameName ?? pointBid.game?.name ?? "Juego";
}

function allocationCount(ballot: CurrentBallot | null, gameId: string): number {
  return ballot?.allocations.find((allocation) => allocation.gameId === gameId)?.voteCount ?? 0;
}

function usedBallotVotes(ballot: CurrentBallot | null): number {
  return ballot?.allocations.reduce((sum, allocation) => sum + allocation.voteCount, 0) ?? 0;
}

function remainingBallotVotes(ballot: CurrentBallot | null, limits: BallotLimits): number {
  return Math.max(0, limits.maxVotes - usedBallotVotes(ballot));
}

function nextBallotAllocations(
  allocations: BallotAllocation[],
  gameId: string,
  delta: number,
  limits: BallotLimits
): { gameId: string; voteCount: number }[] | null {
  const byGame = new Map(allocations.map((allocation) => [allocation.gameId, allocation.voteCount]));
  const nextCount = Math.max(0, (byGame.get(gameId) ?? 0) + delta);

  if (nextCount === 0) {
    byGame.delete(gameId);
  } else {
    byGame.set(gameId, nextCount);
  }

  const next = Array.from(byGame, ([id, voteCount]) => ({ gameId: id, voteCount }));
  const totalVotes = next.reduce((sum, allocation) => sum + allocation.voteCount, 0);

  if (totalVotes > limits.maxVotes) {
    return null;
  }

  if (limits.eligibleGameCount > 1 && next.length >= limits.eligibleGameCount) {
    return null;
  }

  return next;
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
