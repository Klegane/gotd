import { z } from "zod";

import type { ChatbotAction, ChatbotSessionPayload } from "@/types/chatbot";
import { isValidLocalDate, isValidLocalTime } from "@/server/chatbot-dates";

// ---------------------------------------------------------------------------
// Closed action catalog.
//
// The LLM may only choose an `actionKey` from this catalog (plus a small set of
// validated params). It never supplies element ids, hrefs or full payloads:
// the server resolves each key into a complete, trusted ChatbotAction. This is
// the single source of truth — adding a capability means adding an entry here.
// ---------------------------------------------------------------------------

export type CatalogContext = {
  today: string;
};

export const ACTION_KEYS = [
  "go-sessions",
  "go-games",
  "go-profile",
  "go-to-session",
  "open-create-session-form",
  "submit-create-session",
  "cancel-create-session",
  "create-session-direct",
  "open-notifications",
  "refresh-catalog",
  "submit-game-proposal",
  "submit-priority-proposal"
] as const;

export type ActionKey = (typeof ACTION_KEYS)[number];

export const actionParamsSchema = z
  .object({
    sessionId: z.string().min(1).max(64).optional(),
    localDate: z.string().optional(),
    localStartTime: z.string().nullable().optional(),
    title: z.string().max(80).nullable().optional()
  })
  .strict();

export type ActionParams = z.infer<typeof actionParamsSchema>;

export const proposedActionSchema = z.object({
  actionKey: z.enum(ACTION_KEYS),
  params: actionParamsSchema.optional()
});

export type ProposedAction = z.infer<typeof proposedActionSchema>;

type CatalogEntry = {
  /** Human description fed to the model so it knows when to pick this action. */
  description: string;
  /** Pages where the target exists; "*" means available everywhere. */
  availableOn: string;
  resolve: (params: ActionParams, ctx: CatalogContext) => ChatbotAction | null;
};

function navigate(id: string, label: string, href: string, variant: "primary" | "secondary" = "secondary"): ChatbotAction {
  return { id, type: "navigate", label, href, variant };
}

function clickElement(id: string, label: string, targetElementId: string, variant: "primary" | "secondary" = "secondary"): ChatbotAction {
  return { id, type: "click-element", label, targetElementId, variant };
}

const CATALOG: Record<ActionKey, CatalogEntry> = {
  "go-sessions": {
    description: "Ir a la pantalla principal de sesiones (calendario y votación).",
    availableOn: "*",
    resolve: () => navigate("go-sessions", "Ir a sesiones", "/")
  },
  "go-games": {
    description: "Abrir el catálogo de juegos (buscar, favoritos, vetos).",
    availableOn: "*",
    resolve: () => navigate("go-games", "Ver catálogo", "/games")
  },
  "go-profile": {
    description: "Abrir el perfil del usuario (invitaciones, sesiones pasadas, puntos).",
    availableOn: "*",
    resolve: () => navigate("go-profile", "Abrir perfil", "/profile")
  },
  "go-to-session": {
    description: "Abrir una sesión concreta. Requiere params.sessionId.",
    availableOn: "*",
    resolve: (params) => {
      if (!params.sessionId) return null;
      return navigate(`go-to-session-${params.sessionId}`, "Ver sesión", `/sessions/${params.sessionId}`, "primary");
    }
  },
  "open-create-session-form": {
    description: "Abrir el formulario de creación de sesión en la pantalla de sesiones.",
    availableOn: "/",
    resolve: () => clickElement("open-create-session-form", "Abrir formulario de sesión", "open-create-session-button")
  },
  "submit-create-session": {
    description:
      "Pulsar el botón create-session-submit-button para enviar el formulario que el usuario ya tiene relleno en pantalla.",
    availableOn: "/",
    resolve: () => clickElement("submit-create-session", "Crear sesión (formulario)", "create-session-submit-button", "primary")
  },
  "cancel-create-session": {
    description: "Cancelar y cerrar el formulario de creación de sesión.",
    availableOn: "/",
    resolve: () => clickElement("cancel-create-session", "Cancelar formulario", "create-session-cancel-button")
  },
  "create-session-direct": {
    description:
      "Crear una sesión directamente con los datos indicados, sin abrir el formulario. Usa params.localDate (YYYY-MM-DD, " +
      "resuelve fechas relativas a partir de la fecha de hoy), params.localStartTime (HH:MM o null) y params.title (o null).",
    availableOn: "*",
    resolve: (params, ctx) => {
      const localDate = params.localDate && isValidLocalDate(params.localDate) ? params.localDate : ctx.today;
      const localStartTime =
        params.localStartTime && isValidLocalTime(params.localStartTime) ? params.localStartTime : null;
      const payload: ChatbotSessionPayload = {
        localDate,
        localStartTime,
        localEndTime: null,
        title: params.title?.trim() || null,
        notes: null,
        status: "open",
        locationId: null,
        allowPlayerProposals: true,
        invitedUserIds: []
      };

      return {
        id: "create-session-direct",
        type: "create-session",
        label: "Crear sesión",
        description: "Crea la sesión con los datos propuestos.",
        payload,
        variant: "primary"
      };
    }
  },
  "open-notifications": {
    description: "Abrir el panel de avisos/notificaciones de la cabecera.",
    availableOn: "*",
    resolve: () => clickElement("open-notifications", "Abrir avisos", "notifications-button", "primary")
  },
  "refresh-catalog": {
    description: "Refrescar el catálogo de juegos desde la pantalla de sesiones.",
    availableOn: "/",
    resolve: () => clickElement("refresh-catalog", "Refrescar catálogo", "refresh-catalog-button")
  },
  "submit-game-proposal": {
    description: "Enviar una propuesta de juego dentro de una sesión abierta (el usuario debe haber elegido el juego).",
    availableOn: "/sessions",
    resolve: () => clickElement("submit-game-proposal", "Proponer juego", "session-detail-submit-proposal-button", "primary")
  },
  "submit-priority-proposal": {
    description: "Enviar una propuesta con puja de puntos de prioridad dentro de una sesión abierta.",
    availableOn: "/sessions",
    resolve: () =>
      clickElement("submit-priority-proposal", "Proponer con puntos", "session-detail-submit-priority-proposal-button", "primary")
  }
};

/** Resolve a validated proposed action into a trusted ChatbotAction (or null if unusable). */
export function resolveAction(proposed: ProposedAction, ctx: CatalogContext): ChatbotAction | null {
  const entry = CATALOG[proposed.actionKey];
  if (!entry) return null;
  return entry.resolve(proposed.params ?? {}, ctx);
}

/** Resolve a list of proposed actions, dropping any that fail validation/resolution. */
export function resolveActions(proposed: ProposedAction[], ctx: CatalogContext): ChatbotAction[] {
  const resolved: ChatbotAction[] = [];
  for (const item of proposed) {
    const action = resolveAction(item, ctx);
    if (action) resolved.push(action);
  }
  return resolved;
}

/** Catalog description injected into the system prompt. */
export function describeCatalogForPrompt(): string {
  return (Object.keys(CATALOG) as ActionKey[])
    .map((key) => {
      const entry = CATALOG[key];
      const scope = entry.availableOn === "*" ? "cualquier página" : `disponible en ${entry.availableOn}`;
      return `- ${key} (${scope}): ${entry.description}`;
    })
    .join("\n");
}
