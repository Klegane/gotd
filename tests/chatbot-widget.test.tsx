import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChatbotWidget } from "@/components/ChatbotWidget";
import type { ChatbotReply, ChatbotSessionPayload } from "@/types/chatbot";

describe("ChatbotWidget", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("clicks existing page actions from chatbot buttons", () => {
    const clickTarget = document.createElement("button");
    const clickHandler = vi.fn();
    clickTarget.id = "open-create-session-button";
    clickTarget.addEventListener("click", clickHandler);
    document.body.appendChild(clickTarget);

    render(<ChatbotWidget userName="Ada" />);

    fireEvent.click(screen.getByRole("button", { name: "Asistente" }));
    fireEvent.click(screen.getByRole("button", { name: "Crear sesion" }));

    expect(clickHandler).toHaveBeenCalledTimes(1);
  });

  it("creates a session through the existing sessions API", async () => {
    const payload: ChatbotSessionPayload = {
      localDate: "2026-06-03",
      localStartTime: "20:00",
      localEndTime: null,
      title: null,
      notes: null,
      status: "open",
      locationId: null,
      allowPlayerProposals: true,
      invitedUserIds: []
    };
    const reply: ChatbotReply = {
      message: "Lista para crear.",
      actions: [
        {
          id: "create-session-from-test",
          type: "create-session",
          label: "Crear sesion preparada",
          payload,
          variant: "primary"
        }
      ]
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/chatbot") {
        return jsonResponse(reply);
      }

      if (url === "/api/sessions") {
        return jsonResponse({ session: { id: "session_2" } });
      }

      return jsonResponse({});
    });
    const createdHandler = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    window.addEventListener("mesa:session-created", createdHandler);

    render(<ChatbotWidget userName="Ada" />);

    fireEvent.click(screen.getByRole("button", { name: "Asistente" }));
    fireEvent.change(screen.getByPlaceholderText("Pregunta o pide una accion"), {
      target: { value: "crea una sesion" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Crear sesion preparada" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Crear sesion preparada" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/sessions",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(payload)
        })
      );
    });
    expect(createdHandler).toHaveBeenCalledWith(expect.objectContaining({ detail: { sessionId: "session_2" } }));

    window.removeEventListener("mesa:session-created", createdHandler);
  });
});

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body
  } as Response;
}
