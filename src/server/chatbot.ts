import type { ChatbotAction, ChatbotReply, ChatbotSessionPayload } from "@/types/chatbot";
import {
  extractLocalDate,
  extractLocalStartTime,
  extractTitle,
  normalizeText
} from "@/server/chatbot-dates";

type ChatbotContext = {
  today: string;
};

type SessionDraft = {
  payload: ChatbotSessionPayload;
  hasExplicitDate: boolean;
  hasExplicitTime: boolean;
};

const OPEN_CREATE_FORM_ACTION: ChatbotAction = {
  id: "open-create-session-form",
  type: "click-element",
  label: "Abrir formulario de sesion",
  targetElementId: "open-create-session-button",
  variant: "secondary"
};

const SUBMIT_CREATE_FORM_ACTION: ChatbotAction = {
  id: "submit-create-session-form",
  type: "click-element",
  label: "Pulsar create-session-submit-button",
  description: "Usa los datos que tengas ya rellenados en el formulario.",
  targetElementId: "create-session-submit-button",
  variant: "secondary"
};

const GO_SESSIONS_ACTION: ChatbotAction = {
  id: "go-to-sessions",
  type: "navigate",
  label: "Ir a sesiones",
  href: "/",
  variant: "secondary"
};

const GO_GAMES_ACTION: ChatbotAction = {
  id: "go-to-games",
  type: "navigate",
  label: "Ver catalogo",
  href: "/games",
  variant: "secondary"
};

const GO_PROFILE_ACTION: ChatbotAction = {
  id: "go-to-profile",
  type: "navigate",
  label: "Abrir perfil",
  href: "/profile",
  variant: "secondary"
};

export function createChatbotReply(message: string, context: ChatbotContext): ChatbotReply {
  const trimmed = message.trim();
  const normalized = normalizeText(trimmed);

  if (!trimmed) {
    return {
      message: "Escribeme una duda sobre sesiones, votos, juegos o perfil y te propongo el siguiente paso.",
      actions: [GO_SESSIONS_ACTION, GO_GAMES_ACTION]
    };
  }

  if (normalized.includes("create-session-submit-button")) {
    return {
      message: "Puedo pulsar ese boton por ti si el formulario de creacion ya esta visible y revisado.",
      actions: [SUBMIT_CREATE_FORM_ACTION, OPEN_CREATE_FORM_ACTION]
    };
  }

  if (isCreateSessionIntent(normalized)) {
    return createSessionReply(trimmed, normalized, context.today);
  }

  if (hasAny(normalized, ["votar", "voto", "papeleta", "resultado", "resultados"])) {
    return {
      message:
        "Para votar, entra en una sesion abierta y usa los controles de cada juego. Si la sesion permite multivoto, la pantalla te muestra cuantos votos te quedan.",
      actions: [GO_SESSIONS_ACTION]
    };
  }

  if (hasAny(normalized, ["juego", "juegos", "catalogo", "bgg", "boardgamegeek", "proponer", "propuesta"])) {
    return {
      message:
        "Puedes revisar el catalogo, marcar favoritos o vetos, y proponer juegos dentro de una sesion abierta si las propuestas estan habilitadas.",
      actions: [GO_GAMES_ACTION, GO_SESSIONS_ACTION]
    };
  }

  if (hasAny(normalized, ["perfil", "favorito", "favoritos", "veto", "vetos", "puntos", "prioridad"])) {
    return {
      message:
        "En tu perfil ves invitaciones, sesiones pasadas y puntos de prioridad. Los favoritos y vetos se gestionan desde el catalogo de juegos.",
      actions: [GO_PROFILE_ACTION, GO_GAMES_ACTION]
    };
  }

  if (hasAny(normalized, ["aviso", "avisos", "notificacion", "notificaciones"])) {
    return {
      message: "Los avisos se abren desde la cabecera. Desde ahi puedes marcar todo como leido o entrar en la sesion relacionada.",
      actions: [
        {
          id: "open-notifications",
          type: "click-element",
          label: "Abrir avisos",
          targetElementId: "notifications-button",
          variant: "primary"
        }
      ]
    };
  }

  return {
    message:
      "Puedo ayudarte a crear sesiones, encontrar donde votar, revisar juegos, abrir avisos o ir a tu perfil. Prueba con algo como: crea una sesion para manana a las 19:00.",
    actions: [OPEN_CREATE_FORM_ACTION, GO_SESSIONS_ACTION, GO_GAMES_ACTION]
  };
}

function createSessionReply(original: string, normalized: string, today: string): ChatbotReply {
  const draft = extractSessionDraft(original, normalized, today);
  const dateCopy = draft.hasExplicitDate ? draft.payload.localDate : `hoy (${draft.payload.localDate})`;
  const timeCopy = draft.hasExplicitTime && draft.payload.localStartTime ? ` a las ${draft.payload.localStartTime}` : "";

  return {
    message:
      `He preparado una accion para crear una sesion el ${dateCopy}${timeCopy}. ` +
      "Tambien puedes abrir el formulario si prefieres revisar todos los campos antes.",
    actions: [
      {
        id: "create-session-from-chat",
        type: "create-session",
        label: draft.hasExplicitDate ? "Crear sesion" : "Crear sesion para hoy",
        payload: draft.payload,
        variant: "primary"
      },
      OPEN_CREATE_FORM_ACTION,
      SUBMIT_CREATE_FORM_ACTION
    ]
  };
}

function extractSessionDraft(original: string, normalized: string, today: string): SessionDraft {
  const extractedDate = extractLocalDate(original, normalized, today);
  const extractedTime = extractLocalStartTime(normalized);

  return {
    payload: {
      localDate: extractedDate ?? today,
      localStartTime: extractedTime,
      localEndTime: null,
      title: extractTitle(original),
      notes: null,
      status: "open",
      locationId: null,
      allowPlayerProposals: true,
      invitedUserIds: []
    },
    hasExplicitDate: Boolean(extractedDate),
    hasExplicitTime: Boolean(extractedTime)
  };
}

function isCreateSessionIntent(normalized: string): boolean {
  return (
    hasAny(normalized, ["crear", "crea", "nueva", "nuevo", "organizar", "montar"]) &&
    hasAny(normalized, ["sesion", "partida", "mesa", "quedada"])
  );
}

function hasAny(value: string, terms: string[]): boolean {
  return terms.some((term) => value.includes(term));
}
