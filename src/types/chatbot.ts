export type ChatbotSessionStatus = "draft" | "open" | "closed" | "cancelled";

export type ChatbotSessionPayload = {
  localDate: string;
  localStartTime: string | null;
  localEndTime: string | null;
  title: string | null;
  notes: string | null;
  status: ChatbotSessionStatus;
  locationId: string | null;
  allowPlayerProposals: boolean;
  invitedUserIds: string[];
};

export type ChatbotAction = {
  id: string;
  type: "click-element" | "create-session" | "navigate";
  label: string;
  description?: string;
  variant?: "primary" | "secondary";
  targetElementId?: string;
  href?: string;
  payload?: ChatbotSessionPayload;
};

export type ChatbotReply = {
  message: string;
  actions: ChatbotAction[];
};

export type ChatbotMessageInput = {
  role: "user" | "assistant";
  text: string;
};

/** Max conversation turns kept when sending history to the assistant. */
export const CHATBOT_HISTORY_LIMIT = 8;

export type ChatbotRequest = {
  /** Conversation history (preferred). The last user turn drives the reply. */
  messages?: ChatbotMessageInput[];
  /** Legacy single-message shape, kept for backwards compatibility. */
  message?: string;
  /** Client route (e.g. "/", "/games") so the agent knows which buttons exist now. */
  currentPath?: string;
};
