import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppHeader } from "@/components/AppHeader";

const { pathnameMock } = vi.hoisted(() => ({
  pathnameMock: vi.fn(() => "/")
}));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock()
}));

vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
  signOut: vi.fn()
}));

vi.mock("@/components/NotificationsButton", () => ({
  NotificationsButton: () => <button id="notifications-button">Avisos</button>
}));

describe("AppHeader", () => {
  beforeEach(() => {
    pathnameMock.mockReturnValue("/");
  });

  afterEach(() => {
    cleanup();
  });

  it("renders shared navigation, notifications, profile access, and auth controls", () => {
    render(<AppHeader userName="Ada" userRole="admin" />);

    expect(screen.getByLabelText("Mesa del Dia")).toBeTruthy();
    expect(screen.getByText("Sesiones")).toBeTruthy();
    expect(screen.getByText("Juegos")).toBeTruthy();
    expect(screen.getByText("Perfil")).toBeTruthy();
    expect(screen.getByText("Avisos")).toBeTruthy();
    expect(screen.getByText("Ada")).toBeTruthy();
    expect(screen.getByText("Admin")).toBeTruthy();
  });

  it("marks game detail routes as part of the games section", () => {
    pathnameMock.mockReturnValue("/games/game_1");

    const { getByText } = render(<AppHeader userName="Ada" userRole="user" />);

    expect(getByText("Juegos").getAttribute("aria-current")).toBe("page");
    expect(getByText("Sesiones").getAttribute("aria-current")).toBeNull();
  });

  it("marks session detail routes as part of the sessions section", () => {
    pathnameMock.mockReturnValue("/sessions/session_1");

    const { getByText } = render(<AppHeader userName="Ada" userRole="user" />);

    expect(getByText("Sesiones").getAttribute("aria-current")).toBe("page");
  });
});
