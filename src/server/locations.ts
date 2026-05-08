import { prisma } from "@/server/db";

export async function getAllLocations() {
  return prisma.location.findMany({
    orderBy: { name: "asc" }
  });
}

export async function createLocation(userId: string, data: { name: string; address: string }) {
  const name = data.name.trim();
  const address = data.address.trim();

  if (!name) {
    throw new InvalidLocationError("Location name is required");
  }

  if (!address) {
    throw new InvalidLocationError("Location address is required");
  }

  return prisma.location.create({
    data: {
      name,
      address,
      createdByUserId: userId
    }
  });
}

export class InvalidLocationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidLocationError";
  }
}
