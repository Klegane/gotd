import { afterEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  userNotification: {
    count: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn()
  }
}));

vi.mock("@/server/db", () => ({
  prisma: prismaMock
}));

import {
  createNotification,
  InvalidNotificationError,
  markAllNotificationsRead,
  markNotificationRead
} from "@/server/notifications";

describe("notifications", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("skips self notifications", async () => {
    await expect(
      createNotification({
        userId: "user_1",
        actorUserId: "user_1",
        type: "session_message",
        title: "Message"
      })
    ).resolves.toBeNull();

    expect(prismaMock.userNotification.create).not.toHaveBeenCalled();
  });

  it("deduplicates unread notifications by dedupe key", async () => {
    prismaMock.userNotification.findFirst.mockResolvedValue({ id: "notification_1" });
    prismaMock.userNotification.update.mockResolvedValue({ id: "notification_1" });

    await createNotification({
      userId: "user_1",
      actorUserId: "user_2",
      type: "session_message",
      title: "New message",
      dedupeKey: "message:session_1:user_1"
    });

    expect(prismaMock.userNotification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "notification_1" },
        data: expect.objectContaining({ title: "New message" })
      })
    );
    expect(prismaMock.userNotification.create).not.toHaveBeenCalled();
  });

  it("marks owned notifications as read", async () => {
    prismaMock.userNotification.updateMany.mockResolvedValue({ count: 1 });

    await markNotificationRead("user_1", "notification_1");

    expect(prismaMock.userNotification.updateMany).toHaveBeenCalledWith({
      where: {
        id: "notification_1",
        userId: "user_1"
      },
      data: {
        readAt: expect.any(Date)
      }
    });
  });

  it("rejects marking another user's notification", async () => {
    prismaMock.userNotification.updateMany.mockResolvedValue({ count: 0 });

    await expect(markNotificationRead("user_1", "notification_2")).rejects.toThrow(InvalidNotificationError);
  });

  it("marks all unread notifications for a user", async () => {
    prismaMock.userNotification.updateMany.mockResolvedValue({ count: 2 });

    await markAllNotificationsRead("user_1");

    expect(prismaMock.userNotification.updateMany).toHaveBeenCalledWith({
      where: {
        userId: "user_1",
        readAt: null
      },
      data: {
        readAt: expect.any(Date)
      }
    });
  });
});
