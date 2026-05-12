import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NotificationsButton } from "@/components/NotificationsButton";

describe("NotificationsButton", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows unread count and marks all notifications read", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/notifications/read-all" && init?.method === "POST") {
        return jsonResponse({ ok: true });
      }

      if (url === "/api/notifications") {
        return jsonResponse({
          unreadCount: 1,
          notifications: [
            {
              id: "notification_1",
              type: "session_invitation",
              title: "Nueva invitacion",
              body: "Viernes",
              href: "/sessions/session_1",
              readAt: null,
              createdAt: "2026-05-10T00:00:00.000Z"
            }
          ]
        });
      }

      return jsonResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<NotificationsButton />);

    await waitFor(() => {
      expect(container.querySelector(".notification-count")?.textContent).toBe("1");
    });

    fireEvent.click(container.querySelector("#notifications-button") as HTMLButtonElement);
    expect(container.querySelector("#notifications-panel")?.textContent).toContain("Nueva invitacion");

    fireEvent.click(container.querySelector(".notifications-panel-header .tiny-button") as HTMLButtonElement);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/notifications/read-all", { method: "POST" });
    });
  });
});

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body
  } as Response;
}
