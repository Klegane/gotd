"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

import { AuthButton } from "@/components/AuthButton";
import { NotificationsButton } from "@/components/NotificationsButton";

type AppHeaderProps = {
  userName: string;
  userRole: "admin" | "user";
};

const navigationItems = [
  {
    href: "/",
    label: "Sesiones",
    isActive(pathname: string) {
      return pathname === "/" || pathname.startsWith("/sessions");
    }
  },
  {
    href: "/games",
    label: "Juegos",
    isActive(pathname: string) {
      return pathname.startsWith("/games");
    }
  },
  {
    href: "/profile",
    label: "Perfil",
    isActive(pathname: string) {
      return pathname.startsWith("/profile");
    }
  }
];

export function AppHeader({ userName, userRole }: AppHeaderProps) {
  const pathname = usePathname() ?? "/";

  return (
    <header id="app-header" className="app-header">
      <div className="app-header-inner">
        <Link id="app-brand" className="app-brand" href="/" aria-label="Mesa del Dia">
          <span className="brand-mark" aria-hidden="true">
            M
          </span>
          <span className="brand-copy">
            <span className="brand-name">Mesa del Dia</span>
            <span className="brand-subtitle">Sesiones y votaciones</span>
          </span>
        </Link>

        <nav id="app-primary-nav" className="app-nav" aria-label="Navegación principal">
          {navigationItems.map((item) => {
            const active = item.isActive(pathname);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`app-nav-link${active ? " active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div id="app-header-actions" className="app-header-actions">
          {userRole === "admin" ? <span className="role-badge">Admin</span> : null}
          <NotificationsButton />
          <AuthButton idPrefix="app-shell-auth" userName={userName} />
        </div>
      </div>
    </header>
  );
}
