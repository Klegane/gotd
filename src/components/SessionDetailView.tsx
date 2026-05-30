"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useRef, useState } from "react";

import { GameCurationPanel } from "@/components/GameCurationPanel";
import { GamePickerDropdown } from "@/components/GamePickerDropdown";
import { GamePreferenceControl } from "@/components/GamePreferenceControl";
import { playersLabel } from "@/components/gameDiscovery";
import {
  formFromSession,
  formPayload,
  formatSessionDateSpanish,
  formatSessionTime,
  SessionParticipantsPanel,
  SessionFormFields,
  sessionDisplayTitle,
  type BallotAllocation,
  type Game,
  type LocationInfo,
  type PreferenceState,
  type RegisteredUser,
  type SessionForm,
  type SessionParticipant,
  type SessionStatus
} from "@/components/VotingDashboard";

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
  allowPlayerProposals: boolean;
  playedGameId: string | null;
  pointsSettledAt: string | null;
};

type AllVote = {
  userId: string;
  userName: string | null;
  userImage: string | null;
  gameId: string;
  gameName: string;
  gameThumbnailUrl: string | null;
  voteCount?: number;
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
  currentBallot: CurrentBallot | null;
  results: VoteResults;
  curatedGameIds: string[];
  proposals: SessionProposal[];
  priorityProposal: SessionProposal | null;
  ballotLimits: BallotLimits;
  priorityPointBalance: number;
  availablePriorityPoints: number;
  canProposeGames: boolean;
  canCurateGames: boolean;
  canSettlePoints: boolean;
  closedProposalControlCost: number;
  allVotes: AllVote[];
  participants: SessionParticipant[];
  currentParticipant: SessionParticipant | null;
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
  const router = useRouter();
  const [data, setData] = useState<SessionState | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [catalogGames, setCatalogGames] = useState<Game[]>([]);
  const [locations, setLocations] = useState<LocationInfo[]>([]);
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [editSession, setEditSession] = useState<SessionForm | null>(null);
  const [curatedIds, setCuratedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const [proposalGameId, setProposalGameId] = useState("");
  const [bidInputs, setBidInputs] = useState<Record<string, string>>({});
  const [settlementGameId, setSettlementGameId] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isAdmin = userRole === "admin";
  const proposalGameIsAvailable = catalogGames.some((game) => game.id === proposalGameId);

  const loadSession = useCallback(async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`);

      if (!response.ok) {
        throw new Error("No se pudo cargar la sesión.");
      }

      const result = (await response.json()) as SessionState;
      setData(result);
      setEditSession({
        ...formFromSession(result.session),
        invitedUserIds: result.participants.map((participant) => participant.userId)
      });
      setCuratedIds(result.curatedGameIds);
      setProposalGameId((current) => (current && result.games.some((game) => game.id === current) ? current : result.games[0]?.id ?? ""));
      setSettlementGameId(result.session.playedGameId ?? result.results.leaders[0]?.gameId ?? result.games[0]?.id ?? "");
      setBidInputs((current) => ({
        ...current,
        ...(result.currentBallot?.pointBid
          ? { [result.currentBallot.pointBid.gameId]: String(result.currentBallot.pointBid.points) }
          : {})
      }));
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

  const loadUsers = useCallback(async () => {
    try {
      const response = await fetch("/api/users");

      if (response.ok) {
        const body = (await response.json()) as { users: RegisteredUser[] };
        setUsers(body.users);
      }
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    void loadSession();
    void loadMessages();
    void loadCatalog();
    void loadLocations();
    void loadUsers();
  }, [loadSession, loadMessages, loadCatalog, loadLocations, loadUsers]);

  // Poll messages every 30 seconds, only while the tab is visible
  useEffect(() => {
    function tick() {
      if (document.visibilityState === "visible") {
        void loadMessages();
      }
    }

    const interval = setInterval(tick, 30000);
    document.addEventListener("visibilitychange", tick);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
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
          .map((v) => ({ name: v.userName ?? "Anónimo", image: v.userImage, voteCount: v.voteCount ?? 1 }))
      }))
    : [];

  async function updateBallot(gameId: string, delta: number) {
    if (!data) return;

    const allocations = nextBallotAllocations(data.currentBallot?.allocations ?? [], gameId, delta, data.ballotLimits);

    if (!allocations) {
      setError("No puedes votar a todos los juegos disponibles ni superar tu capacidad de voto.");
      return;
    }

    if (allocations.length === 0) {
      setError("La papeleta debe mantener al menos un voto.");
      return;
    }

    setWorking(`ballot-${gameId}`);
    setError(null);

    try {
      const response = await fetch(`/api/sessions/${sessionId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allocations })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "No se pudo guardar tu voto.");
      }

      setData((await response.json()) as SessionState);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar tu papeleta.");
    } finally {
      setWorking(null);
    }
  }

  async function proposeGame(isPriority = false) {
    if (!proposalGameId) return;

    setWorking(isPriority ? "priority-proposal" : "proposal");
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/sessions/${sessionId}/proposals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: proposalGameId, isPriority })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "No se pudo proponer el juego.");
      }

      await loadSession();
      setNotice(isPriority ? "Propuesta prioritaria guardada." : "Juego propuesto.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo proponer el juego.");
    } finally {
      setWorking(null);
    }
  }

  async function setPriorityProposal(gameId: string) {
    setWorking(`priority-${gameId}`);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/sessions/${sessionId}/priority`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "No se pudo marcar la prioridad.");
      }

      await loadSession();
      setNotice("Prioridad actualizada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo marcar la prioridad.");
    } finally {
      setWorking(null);
    }
  }

  async function submitPointBid(gameId: string) {
    const points = Number(bidInputs[gameId] ?? "0");
    setWorking(`bid-${gameId}`);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/sessions/${sessionId}/priority`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, points })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "No se pudo apostar puntos.");
      }

      setData((await response.json()) as SessionState);
      setNotice("Apuesta de puntos guardada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo apostar puntos.");
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

  async function respondToInvitation(status: "accepted" | "declined" | "maybe") {
    setWorking(`participant-response-${status}`);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/sessions/${sessionId}/participants/response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "No se pudo guardar tu respuesta.");
      }

      await loadSession();
      setNotice("Respuesta guardada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar tu respuesta.");
    } finally {
      setWorking(null);
    }
  }

  async function markAttendance(userId: string, status: "attended" | "absent") {
    setWorking(`attendance-${userId}-${status}`);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/sessions/${sessionId}/participants/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, status })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "No se pudo guardar asistencia.");
      }

      await loadSession();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar asistencia.");
    } finally {
      setWorking(null);
    }
  }

  async function saveSession(nextStatus?: SessionStatus) {
    if (!data || !editSession) return;

    setWorking("save-session");
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/admin/sessions/${sessionId}`, {
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

      await loadSession();
      setNotice("Sesión actualizada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la sesión.");
    } finally {
      setWorking(null);
    }
  }

  async function cancelSession() {
    if (!data) return;

    setWorking("cancel-session");
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/admin/sessions/${sessionId}/cancel`, {
        method: "POST"
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "No se pudo cancelar la sesión.");
      }

      await loadSession();
      setNotice("Sesión cancelada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cancelar la sesión.");
    } finally {
      setWorking(null);
    }
  }

  async function deleteSession() {
    if (!data || deleteConfirmation !== "BORRAR") return;

    setWorking("delete-session");
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/admin/sessions/${sessionId}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "No se pudo borrar la sesión.");
      }

      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo borrar la sesión.");
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

  async function settlePlayedGame() {
    if (!settlementGameId) return;

    setWorking("settle-points");
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/sessions/${sessionId}/settlement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playedGameId: settlementGameId })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "No se pudo cerrar el juego jugado.");
      }

      setData((await response.json()) as SessionState);
      setNotice("Juego jugado registrado y puntos asentados.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cerrar el juego jugado.");
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

  if (loading) {
    return <p id="session-detail-loading" className="status-line">Cargando sesión...</p>;
  }

  if (!data) {
    return <p id="session-detail-not-found" className="status-line">{error ?? "Sesión no encontrada."}</p>;
  }

  return (
    <div id={`session-detail-view-${sessionId}`} className="session-detail-page">
      <Link id="session-detail-back-link" href="/" className="back-link">&larr; Volver a sesiones</Link>

      <div id="session-detail-header" className="session-detail-header">
        <div id="session-detail-title-block">
          <p className="eyebrow">{formatSessionDateSpanish(data.session.localDate)}</p>
          <h2 id="session-detail-title">{sessionDisplayTitle(data.session)}</h2>
          <p className="status-line">{formatSessionTime(data.session)}</p>
          {data.session.location ? (
            <p className="status-line">{data.session.location.name} — {data.session.location.address}</p>
          ) : null}
          <p id="session-detail-proposal-policy" className="status-line">
            {data.session.allowPlayerProposals ? "Propuestas de jugadores abiertas" : "Propuestas cerradas por el creador"}
          </p>
          <p id="session-detail-ballot-summary" className="status-line">
            {data.currentBallot?.allocations.length ? `Tu papeleta: ${ballotSummary(data.currentBallot)}` : "Aún no has enviado papeleta."}
          </p>
          <p id="session-detail-points-summary" className="status-line">
            Tus puntos: {data.priorityPointBalance} disponibles: {data.availablePriorityPoints}
          </p>
        </div>
        <span id="session-detail-status" className={`status-pill ${data.session.status}`}>{data.session.status}</span>
      </div>

      {error ? <p id="session-detail-error" className="status-line" style={{ color: "var(--color-danger)" }}>{error}</p> : null}
      {notice ? <p id="session-detail-notice" className="status-line">{notice}</p> : null}

      <SessionParticipantsPanel
        idPrefix="session-detail-participants"
        participants={data.participants}
        users={users}
        canManage={data.canCurateGames || isAdmin}
        currentParticipant={data.currentParticipant}
        onRespond={respondToInvitation}
        onMarkAttendance={markAttendance}
        working={working}
      />

      <div className={`session-detail-layout${isAdmin || data.canCurateGames ? "" : " no-management"}`}>
        <div className="session-detail-main">
      {/* Available games */}
      <section id="session-games-section" className="detail-section" aria-labelledby="session-games-title">
        <div id="session-games-header" className="detail-section-header">
          <div>
            <h3 id="session-games-title">Juegos disponibles</h3>
            <p id="session-current-vote-summary" className="status-line">
              {data.currentBallot?.allocations.length
                ? `Tu papeleta: ${ballotSummary(data.currentBallot)}`
                : "Elige juegos para esta sesión."}
            </p>
            <p id="session-ballot-capacity" className="status-line">
              Puedes repartir hasta {data.ballotLimits.maxVotes} {data.ballotLimits.maxVotes === 1 ? "voto" : "votos"}.
              {" "}Te quedan {remainingBallotVotes(data.currentBallot, data.ballotLimits)}.
            </p>
          </div>
        </div>

        {data.canProposeGames ? (
          <div id="session-detail-proposal-controls" className="proposal-controls">
            <GamePickerDropdown
              id="session-detail-proposal-game-select"
              name="session-detail-proposal-game"
              label="Proponer juego"
              games={catalogGames}
              value={proposalGameId}
              onChange={setProposalGameId}
              emptyText="No hay juegos en el catalogo"
            />
            <button
              id="session-detail-submit-proposal-button"
              type="button"
              className="button secondary"
              onClick={() => proposeGame(false)}
              disabled={!proposalGameIsAvailable || working === "proposal"}
            >
              {working === "proposal" ? "Proponiendo..." : "Proponer"}
            </button>
            <button
              id="session-detail-submit-priority-proposal-button"
              type="button"
              className="button primary"
              onClick={() => proposeGame(true)}
              disabled={!proposalGameIsAvailable || working === "priority-proposal"}
            >
              Prioridad
            </button>
          </div>
        ) : null}

        {data.games.length === 0 ? (
          <div id="session-games-empty-state" className="empty-state">
            <h3>No hay juegos disponibles para esta sesión.</h3>
            <p>Actualiza BoardGameGeek o pide a un admin que ajuste la lista de juegos.</p>
          </div>
        ) : (
          <div id="session-detail-game-grid" className="game-grid session-detail-game-grid">
            {data.games.map((game) => {
              const voteCount = allocationCount(data.currentBallot, game.id);
              const selected = voteCount > 0;
              const canVote = data.session.status === "open";
              const remainingVotes = remainingBallotVotes(data.currentBallot, data.ballotLimits);
              const canAddVote = canVote && remainingVotes > 0;
              const canBid = game.priorityProposalByCurrentUser && data.session.status === "open";

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
                    {game.isCreatorOption ? <p className="status-line">Opción del creador</p> : null}
                    {game.proposalCount ? (
                      <p className="status-line">
                        Propuesto {game.proposalCount} {game.proposalCount === 1 ? "vez" : "veces"}
                      </p>
                    ) : null}
                    <GamePreferenceControl
                      idPrefix={`session-detail-game-${game.id}`}
                      preference={game.preference}
                      onChange={(preference) => setPreference(game.id, preference)}
                      disabled={working?.startsWith(`${game.id}-`) ?? false}
                    />
                  </div>
                  <div className="card-actions ballot-actions">
                    <span id={`session-detail-game-allocation-${game.id}`} className="vote-count">
                      {voteCount} {voteCount === 1 ? "voto" : "votos"}
                    </span>
                    <button
                      id={`session-detail-add-vote-${game.id}`}
                      type="button"
                      className={selected ? "button selected-button" : "button primary"}
                      onClick={() => updateBallot(game.id, 1)}
                      disabled={!canAddVote || working === `ballot-${game.id}`}
                    >
                      {working === `ballot-${game.id}` ? "Guardando..." : selected ? "+1 voto" : "Votar"}
                    </button>
                    {voteCount > 0 ? (
                      <button
                        id={`session-detail-remove-vote-${game.id}`}
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
                        id={`session-detail-priority-${game.id}`}
                        type="button"
                        className="tiny-button"
                        onClick={() => setPriorityProposal(game.id)}
                        disabled={working === `priority-${game.id}` || game.priorityProposalByCurrentUser}
                      >
                        {game.priorityProposalByCurrentUser ? "Prioridad activa" : "Marcar prioridad"}
                      </button>
                    ) : null}
                    {canBid ? (
                      <div id={`session-detail-bid-controls-${game.id}`} className="bid-controls">
                        <label htmlFor={`session-detail-bid-input-${game.id}`}>
                          <span>Puntos</span>
                          <input
                            id={`session-detail-bid-input-${game.id}`}
                            name={`session-detail-bid-${game.id}`}
                            type="number"
                            min={0}
                            max={data.availablePriorityPoints}
                            value={bidInputs[game.id] ?? ""}
                            onChange={(event) => setBidInputs((current) => ({ ...current, [game.id]: event.target.value }))}
                          />
                        </label>
                        <button
                          id={`session-detail-bid-submit-${game.id}`}
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
        )}
      </section>

      {/* Vote Results */}
      <section id="session-votes-section" className="detail-section" aria-labelledby="session-votes-title">
        <h3 id="session-votes-title">
          Resultado ({data.results.totalNormalVotes ?? data.results.totalVotes} votos + {data.results.totalBidPoints ?? 0} puntos - {data.results.totalVetoPenalty ?? 0} vetos)
        </h3>
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
                  <span className="vote-count">{item.score ?? item.votes} total</span>
                  <p className="status-line">
                    {item.normalVotes ?? item.votes} votos + {item.bidPoints ?? 0} puntos - {item.vetoPenalty ?? 0} por {item.vetoCount ?? 0} veto
                    {(item.vetoCount ?? 0) === 1 ? "" : "s"}
                  </p>
                  <div id={`session-voter-list-${item.gameId}`} className="voter-list">
                    {item.voters.map((voter, i) => (
                      <span key={i} className="voter-chip">
                        {voter.image ? (
                          <img src={voter.image} alt="" className="voter-avatar" />
                        ) : null}
                        {voter.name}{voter.voteCount > 1 ? ` x${voter.voteCount}` : ""}
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
        </div>
        <p id="session-notes-content" className="status-line">{data.session.notes || "Sin notas."}</p>
      </section>

      {/* Location */}
      <section id="session-location-section" className="detail-section" aria-labelledby="session-location-title">
        <h3 id="session-location-title">Lugar</h3>
        <p id="session-location-content" className="status-line">
          {data.session.location ? `${data.session.location.name} - ${data.session.location.address}` : "Sin lugar asignado."}
        </p>
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

        {isAdmin || data.canCurateGames ? (
          <aside id="session-detail-management-panel" className="results-panel session-detail-management" aria-label="Gestión de sesión">
            {isAdmin && editSession ? (
              <div id="session-detail-admin-panel" className="admin-panel">
                <h2 id="session-detail-admin-title">Admin de sesión</h2>
                <SessionFormFields
                  idPrefix="detail-admin-session"
                  form={editSession}
                  onChange={setEditSession}
                  locations={locations}
                  users={users}
                  closedProposalCost={editSession.allowPlayerProposals ? 0 : data.closedProposalControlCost}
                />
                <div id="session-detail-admin-actions" className="admin-actions">
                  <button
                    id="session-detail-save-session-button"
                    type="button"
                    className="button primary"
                    onClick={() => saveSession()}
                    disabled={working === "save-session"}
                  >
                    Guardar
                  </button>
                  <button
                    id="session-detail-close-session-button"
                    type="button"
                    className="button secondary"
                    onClick={() => saveSession("closed")}
                    disabled={working === "save-session"}
                  >
                    Cerrar
                  </button>
                  <button
                    id="session-detail-cancel-session-button"
                    type="button"
                    className="button secondary"
                    onClick={cancelSession}
                    disabled={working === "cancel-session"}
                  >
                    Cancelar
                  </button>
                  <button
                    id="session-detail-open-delete-session-dialog-button"
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
                {data.canSettlePoints ? (
                  <div id="session-detail-settlement-controls" className="settlement-controls">
                    <label htmlFor="session-detail-played-game-select">
                      <span>Juego jugado</span>
                      <select
                        id="session-detail-played-game-select"
                        name="session-detail-played-game"
                        value={settlementGameId}
                        onChange={(event) => setSettlementGameId(event.target.value)}
                      >
                        {data.games.map((game) => (
                          <option key={game.id} value={game.id}>
                            {game.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      id="session-detail-settle-points-button"
                      type="button"
                      className="button primary"
                      onClick={settlePlayedGame}
                      disabled={!settlementGameId || working === "settle-points"}
                    >
                      {data.session.pointsSettledAt ? "Revisar cierre" : "Registrar y asentar"}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {data.canCurateGames ? (
              <div id="session-detail-curation-panel" className="admin-panel">
                <GameCurationPanel
                  idPrefix="session-detail-game-curation"
                  games={catalogGames}
                  selectedGameIds={curatedIds}
                  onSelectedGameIdsChange={setCuratedIds}
                  onSave={saveCuratedGames}
                  saving={working === "curate-games"}
                />
              </div>
            ) : null}
          </aside>
        ) : null}
      </div>

      {showDeleteDialog ? (
        <div id="session-detail-delete-session-dialog-backdrop" className="modal-backdrop">
          <section
            id="session-detail-delete-session-dialog"
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="session-detail-delete-session-dialog-title"
            aria-describedby="session-detail-delete-session-dialog-description"
          >
            <h2 id="session-detail-delete-session-dialog-title">Borrar sesión</h2>
            <p id="session-detail-delete-session-dialog-description">
              Esta acción borra definitivamente {sessionDisplayTitle(data.session)} y todos sus votos, propuestas y mensajes.
            </p>
            <label htmlFor="session-detail-delete-session-confirmation-input">
              <span>Escribe BORRAR para confirmar</span>
              <input
                id="session-detail-delete-session-confirmation-input"
                name="session-detail-delete-session-confirmation"
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                autoFocus
              />
            </label>
            <div className="confirm-dialog-actions">
              <button
                id="session-detail-cancel-delete-session-button"
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
                id="session-detail-confirm-delete-session-button"
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

function formatMessageTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function ballotSummary(ballot: CurrentBallot): string {
  const votes = ballot.allocations.map((allocation) => `${allocation.gameName ?? allocation.game?.name ?? "Juego"} x${allocation.voteCount}`).join(", ");
  const bid =
    ballot.pointBid && ballot.pointBid.points > 0
      ? `; ${ballot.pointBid.points} pts a ${ballot.pointBid.gameName ?? ballot.pointBid.game?.name ?? "Juego"}`
      : "";
  return `${votes}${bid}`;
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
