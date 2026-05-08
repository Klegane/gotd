import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Providers } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mesa del Dia",
  description: "Daily board game voting for a local group"
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body id="app-root">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
