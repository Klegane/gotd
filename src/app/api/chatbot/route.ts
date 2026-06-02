import { NextResponse } from "next/server";

import { getRequiredUser } from "@/server/auth";
import { generateChatbotReply } from "@/server/chatbot-agent";
import { createChatbotReply } from "@/server/chatbot";
import { getServerEnv } from "@/server/env";
import { badRequest, unauthorized } from "@/server/http";
import { getLocalDateForTimeZone } from "@/server/voting";
import { CHATBOT_HISTORY_LIMIT, type ChatbotMessageInput, type ChatbotRequest } from "@/types/chatbot";

export const dynamic = "force-dynamic";

const MAX_MESSAGE_LENGTH = 2000;
const KNOWN_PATHS = ["/", "/games", "/profile"];

export async function POST(request: Request) {
  const user = await getRequiredUser();

  if (!user) {
    return unauthorized();
  }

  const body = (await request.json().catch(() => null)) as ChatbotRequest | null;
  const messages = readMessages(body);

  if (messages.length === 0) {
    return badRequest("Message is required");
  }

  const env = getServerEnv();
  const today = getLocalDateForTimeZone(new Date(), env.APP_TIMEZONE);

  if (env.ANTHROPIC_API_KEY) {
    try {
      const reply = await generateChatbotReply(messages, {
        today,
        currentPath: normalizePath(body?.currentPath),
        userName: user.name ?? user.email ?? "Jugador",
        apiKey: env.ANTHROPIC_API_KEY,
        model: env.CHATBOT_MODEL
      });

      return NextResponse.json(reply);
    } catch (error) {
      // Degrade gracefully to the rule-based assistant on any LLM failure.
      console.error("Chatbot agent failed, using rule-based fallback", error);
    }
  }

  const latestUserText = [...messages].reverse().find((message) => message.role === "user")?.text ?? "";
  return NextResponse.json(createChatbotReply(latestUserText, { today }));
}

function readMessages(body: ChatbotRequest | null): ChatbotMessageInput[] {
  if (!body) {
    return [];
  }

  if (Array.isArray(body.messages)) {
    return body.messages
      .filter((message): message is ChatbotMessageInput => Boolean(message) && typeof message.text === "string")
      .map<ChatbotMessageInput>((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        text: message.text.slice(0, MAX_MESSAGE_LENGTH)
      }))
      .slice(-CHATBOT_HISTORY_LIMIT);
  }

  if (typeof body.message === "string") {
    return [{ role: "user", text: body.message.slice(0, MAX_MESSAGE_LENGTH) }];
  }

  return [];
}

function normalizePath(path: string | undefined): string {
  if (!path) {
    return "/";
  }

  if (path.startsWith("/sessions")) {
    return "/sessions";
  }

  return KNOWN_PATHS.includes(path) ? path : "/";
}
