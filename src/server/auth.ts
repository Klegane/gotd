import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { getServerSession, type NextAuthOptions, type Session } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

import { prisma } from "@/server/db";
import { getServerEnv } from "@/server/env";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "database"
  },
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? ""
    })
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        const role = resolveUserRole(user.email ?? null, "role" in user ? String(user.role ?? "user") : "user", getServerEnv().ADMIN_EMAILS);

        if (role === "admin" && "role" in user && user.role !== "admin") {
          await prisma.user.update({
            where: { id: user.id },
            data: { role: "admin" }
          });
        }

        session.user.role = role;
      }

      return session;
    }
  }
};

export async function getCurrentSession(): Promise<Session | null> {
  getServerEnv();
  return getServerSession(authOptions);
}

export function isSessionAuthenticated(session: Session | null): session is Session & { user: NonNullable<Session["user"]> & { id: string } } {
  return Boolean(session?.user?.id);
}

export async function getRequiredUser() {
  const session = await getCurrentSession();

  if (!isSessionAuthenticated(session)) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true
    }
  });

  if (!user) {
    return null;
  }

  const role = resolveUserRole(user.email, user.role, getServerEnv().ADMIN_EMAILS);

  if (role !== user.role) {
    return prisma.user.update({
      where: { id: user.id },
      data: { role },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true
      }
    });
  }

  return user;
}

export function isAdminEmail(email: string | null | undefined, adminEmails: string[]): boolean {
  if (!email) {
    return false;
  }

  const normalizedEmail = email.trim().toLowerCase();
  return adminEmails.some((adminEmail) => adminEmail.trim().toLowerCase() === normalizedEmail);
}

export function resolveUserRole(email: string | null | undefined, currentRole: string | null | undefined, adminEmails: string[]): "admin" | "user" {
  if (currentRole === "admin" || isAdminEmail(email, adminEmails)) {
    return "admin";
  }

  return "user";
}
