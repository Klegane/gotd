import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { VotingDashboard, type Game } from "@/components/VotingDashboard";

describe("VotingDashboard multivote controls", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders proposal, multi-vote, score breakdown, and settlement controls", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const detail = makeSessionDetail(today);
    const sessions = [
      {
        ...detail.session,
        currentBallot: detail.currentBallot,
        results: detail.results
      }
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.startsWith("/api/sessions?")) {
        return jsonResponse({ sessions });
      }

      if (url === "/api/sessions/session_1" && !init) {
        return jsonResponse(detail);
      }

      if (url === "/api/catalog") {
        return jsonResponse({ games: detail.games });
      }

      if (url === "/api/locations") {
        return jsonResponse({ locations: [] });
      }

      if (url === "/api/sessions/session_1/vote" && init?.method === "POST") {
        return jsonResponse(detail);
      }

      return jsonResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<VotingDashboard userRole="admin" />);

    await waitFor(() => {
      expect(container.querySelector("#session-title")?.textContent).toBe("Noche de juegos");
    });

    expect(container.querySelector("#dashboard-proposal-controls")).not.toBeNull();
    expect(container.querySelector("#dashboard-ballot-capacity")?.textContent).toContain("Te quedan 2");
    expect(container.querySelector("#dashboard-settlement-controls")).not.toBeNull();
    expect(container.querySelector("#vote-result-row-game_b")?.textContent).toContain("1 votos + 4 pts");

    fireEvent.click(container.querySelector("#vote-game-add-vote-game_b") as HTMLButtonElement);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/sessions/session_1/vote",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            allocations: [
              { gameId: "game_a", voteCount: 1 },
              { gameId: "game_b", voteCount: 1 }
            ]
          })
        })
      );
    });
  });

  it("requires explicit confirmation before permanently deleting a session", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const detail = makeSessionDetail(today);
    const sessions = [
      {
        ...detail.session,
        currentBallot: detail.currentBallot,
        results: detail.results
      }
    ];
    let deleted = false;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.startsWith("/api/sessions?")) {
        return jsonResponse({ sessions: deleted ? [] : sessions });
      }

      if (url === "/api/sessions/session_1" && !init) {
        return jsonResponse(detail);
      }

      if (url === "/api/catalog") {
        return jsonResponse({ games: detail.games });
      }

      if (url === "/api/locations") {
        return jsonResponse({ locations: [] });
      }

      if (url === "/api/admin/sessions/session_1" && init?.method === "DELETE") {
        deleted = true;
        return jsonResponse({ session: { id: "session_1" } });
      }

      return jsonResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<VotingDashboard userRole="admin" />);

    await waitFor(() => {
      expect(container.querySelector("#session-title")?.textContent).toBe("Noche de juegos");
    });

    fireEvent.click(container.querySelector("#open-delete-session-dialog-button") as HTMLButtonElement);

    const confirmButton = container.querySelector("#confirm-delete-session-button") as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(true);

    fireEvent.change(container.querySelector("#delete-session-confirmation-input") as HTMLInputElement, {
      target: { value: "BORRAR" }
    });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/sessions/session_1",
        expect.objectContaining({
          method: "DELETE"
        })
      );
    });
  });

  it("uses the thumbnail game picker when submitting dashboard proposals", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const detail = makeSessionDetail(today);
    detail.games[3].thumbnailUrl = "/root-thumb.jpg";
    const sessions = [
      {
        ...detail.session,
        currentBallot: detail.currentBallot,
        results: detail.results
      }
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.startsWith("/api/sessions?")) {
        return jsonResponse({ sessions });
      }

      if (url === "/api/sessions/session_1" && !init) {
        return jsonResponse(detail);
      }

      if (url === "/api/catalog") {
        return jsonResponse({ games: detail.games });
      }

      if (url === "/api/locations") {
        return jsonResponse({ locations: [] });
      }

      if (url === "/api/sessions/session_1/proposals" && init?.method === "POST") {
        return jsonResponse(detail);
      }

      return jsonResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<VotingDashboard userRole="admin" />);

    await waitFor(() => {
      expect(container.querySelector("#session-title")?.textContent).toBe("Noche de juegos");
    });

    fireEvent.click(container.querySelector("#dashboard-proposal-game-select") as HTMLButtonElement);
    fireEvent.change(container.querySelector("#dashboard-proposal-game-select-search-input") as HTMLInputElement, {
      target: { value: "root" }
    });

    expect(container.querySelector("#dashboard-proposal-game-select-option-game_d img")?.getAttribute("src")).toBe("/root-thumb.jpg");

    fireEvent.click(container.querySelector("#dashboard-proposal-game-select-option-game_d") as HTMLButtonElement);
    fireEvent.click(container.querySelector("#dashboard-submit-proposal-button") as HTMLButtonElement);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/sessions/session_1/proposals",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ gameId: "game_d", isPriority: false })
        })
      );
    });
  });
});

function makeSessionDetail(localDate: string) {
  const games = [
    game("game_a", "Azul", { proposedByCurrentUser: true, priorityProposalByCurrentUser: true }),
    game("game_b", "Catan"),
    game("game_c", "Dune Imperium"),
    game("game_d", "Root")
  ];

  return {
    session: {
      id: "session_1",
      localDate,
      localStartTime: "19:00",
      localEndTime: null,
      title: "Noche de juegos",
      customTitle: "Noche de juegos",
      notes: null,
      status: "open" as const,
      location: null,
      createdByUserId: "user_1",
      allowPlayerProposals: true,
      playedGameId: null,
      pointsSettledAt: null
    },
    games,
    currentVote: null,
    currentBallot: {
      allocations: [{ gameId: "game_a", gameName: "Azul", voteCount: 1 }],
      pointBid: { gameId: "game_a", gameName: "Azul", points: 2 }
    },
    results: {
      totalVotes: 7,
      totalNormalVotes: 3,
      totalBidPoints: 4,
      leaders: [{ gameId: "game_b", gameName: "Catan", thumbnailUrl: null, votes: 5, normalVotes: 1, bidPoints: 4, score: 5 }],
      items: [
        { gameId: "game_b", gameName: "Catan", thumbnailUrl: null, votes: 5, normalVotes: 1, bidPoints: 4, score: 5 },
        { gameId: "game_a", gameName: "Azul", thumbnailUrl: null, votes: 2, normalVotes: 1, bidPoints: 1, score: 2 }
      ]
    },
    curatedGameIds: [],
    proposals: [],
    priorityProposal: null,
    ballotLimits: {
      eligibleGameCount: 4,
      maxVotes: 3,
      canMultiVote: true
    },
    priorityPointBalance: 10,
    availablePriorityPoints: 8,
    canProposeGames: true,
    canCurateGames: true,
    canSettlePoints: true,
    closedProposalControlCost: 0
  };
}

function game(
  id: string,
  name: string,
  overrides: Partial<Record<"proposedByCurrentUser" | "priorityProposalByCurrentUser", boolean>> = {}
): Game {
  return {
    id,
    bggId: Number(id.replace(/\D/g, "")) || 1,
    name,
    yearPublished: 2020,
    imageUrl: null,
    thumbnailUrl: null,
    minPlayers: 2,
    maxPlayers: 4,
    playingTime: 60,
    averageWeight: 2.5,
    categories: [],
    mechanisms: [],
    families: [],
    designers: [],
    artists: [],
    preference: null,
    isCreatorOption: true,
    proposalCount: overrides.proposedByCurrentUser ? 1 : 0,
    proposedByCurrentUser: overrides.proposedByCurrentUser ?? false,
    priorityProposalByCurrentUser: overrides.priorityProposalByCurrentUser ?? false,
    proposers: []
  };
}

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body
  } as Response;
}
