"use client";

import React, { useMemo, useRef, useState } from "react";

import { CHATBOT_HISTORY_LIMIT, type ChatbotAction, type ChatbotReply, type ChatbotSessionPayload } from "@/types/chatbot";

type ChatbotMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  actions?: ChatbotAction[];
};

type ChatbotWidgetProps = {
  userName: string;
};

const initialMessage: ChatbotMessage = {
  id: "assistant-welcome",
  role: "assistant",
  text: "Hola. Soy el asistente de Mesa del Dia. Puedo ayudarte con sesiones, votos, juegos, avisos y perfil.",
  actions: [
    {
      id: "welcome-create-session",
      type: "click-element",
      label: "Crear sesion",
      targetElementId: "open-create-session-button",
      variant: "primary"
    },
    {
      id: "welcome-games",
      type: "navigate",
      label: "Ver catalogo",
      href: "/games",
      variant: "secondary"
    }
  ]
};

export function ChatbotWidget({ userName }: ChatbotWidgetProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatbotMessage[]>([initialMessage]);
  const [input, setInput] = useState("");
  const [working, setWorking] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const statusText = useMemo(() => {
    if (actionId) return "Ejecutando accion";
    if (working) return "Pensando";
    return "Listo";
  }, [actionId, working]);

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();

    if (!text || working) return;

    setInput("");
    setWorking(true);
    appendMessage({ role: "user", text });

    // Send a trimmed conversation history so the agent has context, plus the
    // current route so it only proposes buttons that exist on this page.
    const history = [...messages, { role: "user" as const, text }]
      .slice(-CHATBOT_HISTORY_LIMIT)
      .map((message) => ({ role: message.role, text: message.text }));
    const currentPath = typeof window !== "undefined" ? window.location.pathname : "/";

    try {
      const response = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, currentPath })
      });

      if (!response.ok) {
        throw new Error("No se pudo consultar el asistente.");
      }

      const reply = (await response.json()) as ChatbotReply;
      appendMessage({ role: "assistant", text: reply.message, actions: reply.actions });
    } catch (error) {
      appendMessage({
        role: "assistant",
        text: error instanceof Error ? error.message : "No se pudo consultar el asistente."
      });
    } finally {
      setWorking(false);
    }
  }

  async function runAction(action: ChatbotAction) {
    setActionId(action.id);

    try {
      if (action.type === "click-element") {
        clickElement(action);
        return;
      }

      if (action.type === "navigate" && action.href) {
        window.location.href = action.href;
        return;
      }

      if (action.type === "create-session" && action.payload) {
        await createSession(action.payload);
      }
    } catch (error) {
      appendMessage({
        role: "assistant",
        text: error instanceof Error ? error.message : "No se pudo ejecutar la accion."
      });
    } finally {
      setActionId(null);
    }
  }

  function clickElement(action: ChatbotAction) {
    if (!action.targetElementId) {
      throw new Error("La accion no tiene un objetivo configurado.");
    }

    const target = document.getElementById(action.targetElementId);

    if (!(target instanceof HTMLElement)) {
      appendMessage({
        role: "assistant",
        text: `No encuentro #${action.targetElementId} en esta pantalla. Te llevo a sesiones para que puedas abrirlo.`
      });
      window.location.href = "/";
      return;
    }

    target.click();
    target.scrollIntoView?.({ block: "center", behavior: "smooth" });
    appendMessage({
      role: "assistant",
      text: `He activado #${action.targetElementId}.`
    });
  }

  async function createSession(payload: ChatbotSessionPayload) {
    const response = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? "No se pudo crear la sesion.");
    }

    const body = (await response.json()) as { session: { id: string } };
    window.dispatchEvent(new CustomEvent("mesa:session-created", { detail: { sessionId: body.session.id } }));
    appendMessage({
      role: "assistant",
      text: `Sesion creada para ${payload.localDate}${payload.localStartTime ? ` a las ${payload.localStartTime}` : ""}.`,
      actions: [
        {
          id: `open-created-session-${body.session.id}`,
          type: "navigate",
          label: "Ver sesion",
          href: `/sessions/${body.session.id}`,
          variant: "primary"
        }
      ]
    });
  }

  function appendMessage(message: Omit<ChatbotMessage, "id">) {
    setMessages((current) => [
      ...current,
      {
        ...message,
        id: `${message.role}-${Date.now()}-${Math.random().toString(36).slice(2)}`
      }
    ]);
  }

  return (
    <section id="chatbot-widget" className={`chatbot-widget${open ? " open" : ""}`} aria-label="Asistente de Mesa del Dia">
      {open ? (
        <div id="chatbot-panel" className="chatbot-panel">
          <header className="chatbot-header">
            <div>
              <p className="eyebrow">Asistente</p>
              <h2>Mesa del Dia</h2>
              <p>{statusText} para {userName}</p>
            </div>
            <button id="chatbot-close-button" type="button" className="tiny-button" onClick={() => setOpen(false)}>
              Cerrar
            </button>
          </header>

          <div id="chatbot-message-list" className="chatbot-message-list" aria-live="polite">
            {messages.map((message) => (
              <article key={message.id} className={`chatbot-message ${message.role}`}>
                <p>{message.text}</p>
                {message.actions?.length ? (
                  <div className="chatbot-actions">
                    {message.actions.map((action) =>
                      action.type === "navigate" && action.href ? (
                        <a
                          key={action.id}
                          href={action.href}
                          className={`chatbot-action ${action.variant === "primary" ? "primary" : "secondary"}`}
                        >
                          {action.label}
                        </a>
                      ) : (
                        <button
                          key={action.id}
                          type="button"
                          className={`chatbot-action ${action.variant === "primary" ? "primary" : "secondary"}`}
                          onClick={() => void runAction(action)}
                          disabled={Boolean(actionId)}
                          title={action.description}
                        >
                          {actionId === action.id ? "Ejecutando..." : action.label}
                        </button>
                      )
                    )}
                  </div>
                ) : null}
              </article>
            ))}
          </div>

          <form id="chatbot-input-form" className="chatbot-input-form" onSubmit={sendMessage}>
            <input
              id="chatbot-input"
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Pregunta o pide una accion"
              disabled={working}
            />
            <button id="chatbot-send-button" type="submit" className="button primary" disabled={!input.trim() || working}>
              Enviar
            </button>
          </form>
        </div>
      ) : null}

      <button
        id="chatbot-toggle-button"
        type="button"
        className="chatbot-toggle button primary"
        aria-expanded={open}
        aria-controls="chatbot-panel"
        onClick={() => {
          setOpen((current) => !current);
          window.setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        Asistente
      </button>
    </section>
  );
}
