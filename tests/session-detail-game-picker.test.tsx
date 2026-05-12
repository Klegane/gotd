import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SessionDetailView } from "@/components/SessionDetailView";
import type { Game } from "@/components/VotingDashboard";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: vi.fn()
  })
}));

describe("SessionDetailView proposal picker", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows thumbnail grid filtering and submits the selected proposal game", async () => {
    const state = makeSessionState();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/sessions/session_1" && !init) {
        return jsonResponse(state);
      }

      if (url === "/api/sessions/session_1/messages") {
        return jsonResponse({ messages: [] });
      }

      if (url === "/api/catalog") {
        return jsonResponse({ games: state.games });
      }

      if (url === "/api/locations") {
        return jsonResponse({ locations: [] });
      }

      if (url === "/api/users") {
        return jsonResponse({ users: [] });
      }

      if (url === "/api/sessions/session_1/proposals" && init?.method === "POST") {
        return jsonResponse(state);
      }

      return jsonResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<SessionDetailView sessionId="session_1" userId="user_1" userRole="user" />);

    await waitFor(() => {
      expect(container.querySelector("#session-detail-title")?.textContent).toBe("Noche de juegos");
    });

    fireEvent.click(container.querySelector("#session-detail-proposal-game-select") as HTMLButtonElement);
    fireEvent.change(container.querySelector("#session-detail-proposal-game-select-search-input") as HTMLInputElement, {
      target: { value: "dune" }
    });

    expect(
      container.querySelector("#session-detail-proposal-game-select-option-game_c img")?.getAttribute("src")
    ).toBe("/dune-thumb.jpg");

    fireEvent.click(container.querySelector("#session-detail-proposal-game-select-option-game_c") as HTMLButtonElement);
    fireEvent.click(container.querySelector("#session-detail-submit-proposal-button") as HTMLButtonElement);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/sessions/session_1/proposals",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ gameId: "game_c", isPriority: false })
        })
      );
    });
  });
});

function makeSessionState() {
  const games = [
    game("game_a", "Azul", { thumbnailUrl: "/azul-thumb.jpg" }),
    game("game_b", "Catan", { imageUrl: "/catan.jpg" }),
    game("game_c", "Dune Imperium", { thumbnailUrl: "/dune-thumb.jpg" })
  ];

  return {
    session: {
      id: "session_1",
      localDate: "2026-05-11",
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
    currentBallot: null,
    results: {
      totalVotes: 0,
      leaders: [],
      items: []
    },
    curatedGameIds: [],
    proposals: [],
    priorityProposal: null,
    ballotLimits: {
      eligibleGameCount: 3,
      maxVotes: 2,
      canMultiVote: true
    },
    priorityPointBalance: 0,
    availablePriorityPoints: 0,
    canProposeGames: true,
    canCurateGames: false,
    canSettlePoints: false,
    closedProposalControlCost: 0,
    allVotes: [],
    participants: [],
    currentParticipant: null
  };
}

function game(id: string, name: string, overrides: Partial<Game> = {}): Game {
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
    proposalCount: 0,
    proposedByCurrentUser: false,
    priorityProposalByCurrentUser: false,
    proposers: [],
    ...overrides
  };
}

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body
  } as Response;
}
