import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import type { ChatbotMessageInput, ChatbotReply } from "@/types/chatbot";
import { ACTION_KEYS, describeCatalogForPrompt, proposedActionSchema, resolveActions } from "@/server/chatbot-actions";

export type AgentContext = {
  today: string;
  currentPath: string;
  userName: string;
  apiKey: string;
  model?: string;
};

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 512;
const MAX_HISTORY = 8;

// The model must answer by calling this single tool, so the output is always
// structured. `message` is the prose shown to the user; `actions` is a list of
// keys from the closed catalog that the server resolves into real buttons.
const PROPOSE_REPLY_TOOL: Anthropic.Tool = {
  name: "propose_reply",
  description:
    "Responde al usuario con un mensaje y, opcionalmente, una lista de acciones (botones) tomadas únicamente del catálogo permitido.",
  input_schema: {
    type: "object",
    properties: {
      message: {
        type: "string",
        description: "Respuesta en español, breve y útil, para mostrar al usuario."
      },
      actions: {
        type: "array",
        description: "Lista de acciones propuestas (botones). Vacía si no aplica ninguna.",
        items: {
          type: "object",
          properties: {
            actionKey: { type: "string", enum: [...ACTION_KEYS] },
            params: {
              type: "object",
              description: "Parámetros opcionales según la acción.",
              properties: {
                sessionId: { type: "string" },
                localDate: { type: "string", description: "Fecha YYYY-MM-DD ya resuelta a partir de hoy." },
                localStartTime: { type: "string", description: "Hora HH:MM o nada." },
                title: { type: "string" }
              }
            }
          },
          required: ["actionKey"]
        }
      }
    },
    required: ["message", "actions"]
  }
};

const toolInputSchema = z.object({
  message: z.string().min(1),
  // Tolerant: unknown/invalid actions are dropped individually rather than
  // failing the whole reply.
  actions: z.array(z.unknown()).default([])
});

function buildSystemPrompt(ctx: AgentContext): string {
  return [
    "Eres el asistente de \"Mesa del Día\", una app para organizar y votar partidas de juegos de mesa.",
    "Respondes SIEMPRE en español, de forma breve, cordial y concreta.",
    "",
    "Tu trabajo es resolver dudas y PROPONER acciones mediante botones. Nunca ejecutas nada por tu cuenta:",
    "el usuario decide pulsando un botón. Por eso siempre respondes llamando a la herramienta propose_reply.",
    "",
    "Reglas para las acciones:",
    "- Usa únicamente actionKeys del catálogo. No inventes botones, ids ni rutas.",
    "- Muchos botones solo existen en ciertas páginas. La página actual del usuario es: " + ctx.currentPath + ".",
    "  Si la acción que necesitas no está disponible en la página actual, propón primero la navegación adecuada",
    "  (go-sessions, go-games, go-profile) y luego, si procede, la acción de click.",
    "- Para crear una sesión tienes dos vías: create-session-direct (crea directamente con los datos) u",
    "  open-create-session-form (abrir el formulario para que el usuario revise). Ofrece la que mejor encaje; puedes ofrecer ambas.",
    "- Para create-session-direct resuelve las fechas relativas (hoy, mañana, pasado mañana) a formato YYYY-MM-DD usando la fecha de hoy.",
    "- El voto de juegos concretos no se automatiza con un botón: guía al usuario llevándole a la sesión (go-to-session/go-sessions).",
    "- Propón como mucho 3 acciones, las más relevantes. Si no aplica ninguna, devuelve actions vacío.",
    "",
    "Fecha de hoy: " + ctx.today + ". Usuario: " + ctx.userName + ".",
    "",
    "Catálogo de acciones disponibles:",
    describeCatalogForPrompt()
  ].join("\n");
}

function toAnthropicMessages(messages: ChatbotMessageInput[]): Anthropic.MessageParam[] {
  return messages.slice(-MAX_HISTORY).map((message) => ({
    role: message.role === "assistant" ? "assistant" : "user",
    content: message.text
  }));
}

/**
 * Generate a chatbot reply using Claude constrained to the closed action
 * catalog. Throws on transport/parse errors so the caller can fall back to the
 * rule-based assistant.
 */
export async function generateChatbotReply(messages: ChatbotMessageInput[], ctx: AgentContext): Promise<ChatbotReply> {
  const client = new Anthropic({ apiKey: ctx.apiKey });

  const response = await client.messages.create({
    model: ctx.model ?? DEFAULT_MODEL,
    max_tokens: MAX_TOKENS,
    // Stable, large prompt → cache it to cut cost/latency on repeat turns.
    system: [{ type: "text", text: buildSystemPrompt(ctx), cache_control: { type: "ephemeral" } }],
    tools: [PROPOSE_REPLY_TOOL],
    tool_choice: { type: "tool", name: "propose_reply" },
    messages: toAnthropicMessages(messages)
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === "propose_reply"
  );

  if (!toolUse) {
    throw new Error("El modelo no devolvió una acción estructurada.");
  }

  const parsed = toolInputSchema.parse(toolUse.input);
  const proposed = parsed.actions
    .map((action) => proposedActionSchema.safeParse(action))
    .flatMap((result) => (result.success ? [result.data] : []));
  const actions = resolveActions(proposed, { today: ctx.today });

  return { message: parsed.message, actions };
}
