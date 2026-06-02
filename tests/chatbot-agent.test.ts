import { afterEach, describe, expect, it, vi } from "vitest";

import { proposedActionSchema, resolveAction, resolveActions } from "@/server/chatbot-actions";

const ctx = { today: "2026-06-02" };

describe("chatbot action catalog", () => {
  it("resolves navigation and click actions with server-fixed targets", () => {
    const sessions = resolveAction({ actionKey: "go-sessions" }, ctx);
    const submit = resolveAction({ actionKey: "submit-create-session" }, ctx);

    expect(sessions).toMatchObject({ type: "navigate", href: "/" });
    expect(submit).toMatchObject({ type: "click-element", targetElementId: "create-session-submit-button" });
  });

  it("drops go-to-session when sessionId is missing", () => {
    expect(resolveAction({ actionKey: "go-to-session" }, ctx)).toBeNull();
    expect(resolveAction({ actionKey: "go-to-session", params: { sessionId: "s_1" } }, ctx)).toMatchObject({
      href: "/sessions/s_1"
    });
  });

  it("defaults create-session-direct to today and drops invalid time, trimming title", () => {
    const action = resolveAction(
      { actionKey: "create-session-direct", params: { localStartTime: "99:99", title: " Ada " } },
      ctx
    );

    expect(action).toMatchObject({
      type: "create-session",
      payload: { localDate: "2026-06-02", localStartTime: null, title: "Ada", status: "open" }
    });
  });

  it("drops create-session-direct for malformed or past dates instead of fabricating one", () => {
    expect(resolveAction({ actionKey: "create-session-direct", params: { localDate: "not-a-date" } }, ctx)).toBeNull();
    expect(resolveAction({ actionKey: "create-session-direct", params: { localDate: "2026-05-01" } }, ctx)).toBeNull();
    expect(
      resolveAction({ actionKey: "create-session-direct", params: { localDate: "2026-06-10", localStartTime: "19:30" } }, ctx)
    ).toMatchObject({ payload: { localDate: "2026-06-10", localStartTime: "19:30" } });
  });

  it("filters page-specific actions by currentPath", () => {
    expect(resolveAction({ actionKey: "submit-create-session" }, { ...ctx, currentPath: "/games" })).toBeNull();
    expect(resolveAction({ actionKey: "submit-create-session" }, { ...ctx, currentPath: "/" })).toMatchObject({
      targetElementId: "create-session-submit-button"
    });
    // Navigation is always available regardless of page.
    expect(resolveAction({ actionKey: "go-games" }, { ...ctx, currentPath: "/profile" })).toMatchObject({ href: "/games" });
  });

  it("rejects actionKeys outside the closed catalog", () => {
    expect(proposedActionSchema.safeParse({ actionKey: "drop-database" }).success).toBe(false);
  });

  it("filters out unresolved actions in resolveActions", () => {
    const resolved = resolveActions(
      [{ actionKey: "go-games" }, { actionKey: "go-to-session" }, { actionKey: "create-session-direct", params: { localDate: "2026-07-01" } }],
      ctx
    );

    expect(resolved.map((action) => action.type)).toEqual(["navigate", "create-session"]);
  });
});

describe("chatbot agent (mocked SDK)", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("turns a tool_use response into a reply with resolved actions", async () => {
    const createMock = vi.fn().mockResolvedValue({
      content: [
        {
          type: "tool_use",
          name: "propose_reply",
          input: {
            message: "Te llevo al catálogo.",
            actions: [{ actionKey: "go-games" }, { actionKey: "invalid-key" }]
          }
        }
      ]
    });

    vi.doMock("@anthropic-ai/sdk", () => ({
      default: class {
        messages = { create: createMock };
      }
    }));

    const { generateChatbotReply } = await import("@/server/chatbot-agent");
    const reply = await generateChatbotReply([{ role: "user", text: "ver juegos" }], {
      today: "2026-06-02",
      currentPath: "/",
      userName: "Ada",
      apiKey: "test-key"
    });

    expect(reply.message).toBe("Te llevo al catálogo.");
    expect(reply.actions).toHaveLength(1);
    expect(reply.actions[0]).toMatchObject({ type: "navigate", href: "/games" });
    expect(createMock).toHaveBeenCalledOnce();
  });

  it("throws when the model returns no tool_use block", async () => {
    vi.doMock("@anthropic-ai/sdk", () => ({
      default: class {
        messages = { create: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "hola" }] }) };
      }
    }));

    const { generateChatbotReply } = await import("@/server/chatbot-agent");

    await expect(
      generateChatbotReply([{ role: "user", text: "hola" }], {
        today: "2026-06-02",
        currentPath: "/",
        userName: "Ada",
        apiKey: "test-key"
      })
    ).rejects.toThrow();
  });
});
