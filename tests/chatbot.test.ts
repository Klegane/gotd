import { describe, expect, it } from "vitest";

import { createChatbotReply } from "@/server/chatbot";

describe("chatbot assistant replies", () => {
  it("prepares a create-session action from a natural language request", () => {
    const reply = createChatbotReply("Crea una sesion manana a las 19:30", { today: "2026-06-02" });
    const action = reply.actions.find((item) => item.type === "create-session");

    expect(reply.message).toContain("2026-06-03");
    expect(action?.payload).toMatchObject({
      localDate: "2026-06-03",
      localStartTime: "19:30",
      status: "open",
      allowPlayerProposals: true
    });
  });

  it("can target the existing create-session-submit-button", () => {
    const reply = createChatbotReply("pulsa create-session-submit-button", { today: "2026-06-02" });

    expect(reply.actions[0]).toMatchObject({
      type: "click-element",
      targetElementId: "create-session-submit-button"
    });
  });

  it("routes profile and preference questions to the relevant screens", () => {
    const reply = createChatbotReply("Donde veo mis vetos y puntos de prioridad?", { today: "2026-06-02" });

    expect(reply.actions.map((action) => action.href)).toEqual(["/profile", "/games"]);
  });
});
