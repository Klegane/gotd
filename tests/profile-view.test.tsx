import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProfileView } from "@/components/ProfileView";

describe("ProfileView", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders profile summaries and saves nicknames", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/profile" && init?.method === "PATCH") {
        return jsonResponse({ user: { id: "user_1", nickname: "Ada" } });
      }

      if (url === "/api/profile") {
        return jsonResponse(profileBody);
      }

      return jsonResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<ProfileView />);

    await waitFor(() => {
      expect(container.querySelector("#profile-vetoes")?.textContent).toContain("Vetos (1/3)");
    });

    fireEvent.change(container.querySelector("#profile-nickname-input") as HTMLInputElement, {
      target: { value: "Ada" }
    });
    fireEvent.click(container.querySelector("#profile-save-button") as HTMLButtonElement);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/profile",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ nickname: "Ada" })
        })
      );
    });
  });
});

const profileBody = {
  user: {
    id: "user_1",
    displayName: "Ada",
    nickname: "Ada",
    name: "Ada Lovelace",
    email: "ada@example.com",
    image: null,
    role: "user"
  },
  favorites: [{ id: "game_1", name: "Azul", thumbnailUrl: null }],
  vetoes: [{ id: "game_2", name: "Catan", thumbnailUrl: null }],
  vetoCapacity: { used: 1, max: 3, remaining: 2 },
  pointBalance: 4,
  pointLedger: [{ id: "ledger_1", amount: 2, reason: "proposal_not_played", createdAt: "2026-05-10T00:00:00.000Z", game: null, session: null }],
  upcomingSessions: [{ participationStatus: "accepted", session: { id: "session_1", title: "Viernes", localDate: "2026-05-15", localStartTime: "19:00", status: "open" } }],
  pastPlayedSessions: []
};

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body
  } as Response;
}
