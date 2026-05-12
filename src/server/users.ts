import { prisma } from "@/server/db";

export type DisplayUser = {
  id: string;
  nickname?: string | null;
  name?: string | null;
  email?: string | null;
};

export function normalizeNickname(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-ES")
    .replace(/\s+/g, " ")
    .trim();
}

export function displayNameForUser(user: DisplayUser): string {
  return user.nickname?.trim() || user.name?.trim() || user.email?.trim() || "Anonimo";
}

export async function listRegisteredUsers() {
  const users = await prisma.user.findMany({
    orderBy: [{ nickname: "asc" }, { name: "asc" }, { email: "asc" }],
    select: {
      id: true,
      nickname: true,
      name: true,
      email: true,
      image: true
    }
  });

  return users.map((user) => ({
    ...user,
    displayName: displayNameForUser(user)
  }));
}
