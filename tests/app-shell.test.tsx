import React from "react";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/AppShell";

const { getCurrentSessionMock } = vi.hoisted(() => ({
  getCurrentSessionMock: vi.fn()
}));

vi.mock("@/server/auth", () => ({
  getCurrentSession: () => getCurrentSessionMock(),
  isSessionAuthenticated: (session: { user?: { id?: string } } | null) => Boolean(session?.user?.id)
}));

vi.mock("@/components/AppHeader", () => ({
  AppHeader: ({ userName }: { userName: string }) => <header id="app-header">Header {userName}</header>
}));

describe("AppShell", () => {
  beforeEach(() => {
    getCurrentSessionMock.mockReset();
  });

  it("renders authenticated chrome around children", async () => {
    getCurrentSessionMock.mockResolvedValue({
      user: { id: "user_1", name: "Ada", email: "ada@example.com", role: "user" }
    });

    const element = await AppShell({ children: <main id="page-content">Contenido</main> });
    const { container } = render(element);

    expect(container.querySelector("#app-header")?.textContent).toContain("Ada");
    expect(container.querySelector("#page-content")?.textContent).toBe("Contenido");
  });

  it("does not expose authenticated chrome without a session", async () => {
    getCurrentSessionMock.mockResolvedValue(null);

    const element = await AppShell({ children: <main id="login-content">Login</main> });
    const { container } = render(element);

    expect(container.querySelector("#app-header")).toBeNull();
    expect(container.querySelector("#login-content")?.textContent).toBe("Login");
  });
});
