"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

export function NotificationsButton() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  async function loadNotifications() {
    const response = await fetch("/api/notifications");

    if (!response.ok) {
      return;
    }

    const body = (await response.json()) as { notifications: NotificationItem[]; unreadCount: number };
    setNotifications(body.notifications);
    setUnreadCount(body.unreadCount);
  }

  async function markAllRead() {
    await fetch("/api/notifications/read-all", { method: "POST" });
    await loadNotifications();
  }

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    await loadNotifications();
  }

  useEffect(() => {
    void loadNotifications();
    const interval = window.setInterval(() => {
      void loadNotifications();
    }, 30000);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <div id="notifications-widget" className="notifications-widget">
      <button
        id="notifications-button"
        type="button"
        className="button secondary notification-trigger"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        Avisos
        {unreadCount > 0 ? <span className="notification-count">{unreadCount}</span> : null}
      </button>
      {open ? (
        <div id="notifications-panel" className="notifications-panel">
          <div className="notifications-panel-header">
            <strong>Notificaciones</strong>
            <button type="button" className="tiny-button" onClick={markAllRead} disabled={unreadCount === 0}>
              Leer todo
            </button>
          </div>
          {notifications.length === 0 ? (
            <p className="status-line">No hay notificaciones.</p>
          ) : (
            notifications.map((notification) => {
              const content = (
                <>
                  <strong>{notification.title}</strong>
                  {notification.body ? <span>{notification.body}</span> : null}
                  <small>{new Date(notification.createdAt).toLocaleString("es-ES")}</small>
                </>
              );

              return (
                <div
                  id={`notification-${notification.id}`}
                  className={`notification-row${notification.readAt ? "" : " unread"}`}
                  key={notification.id}
                  onClick={() => {
                    if (!notification.readAt) {
                      void markRead(notification.id);
                    }
                  }}
                >
                  {notification.href ? (
                    <Link href={notification.href} onClick={() => setOpen(false)}>
                      {content}
                    </Link>
                  ) : (
                    content
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
