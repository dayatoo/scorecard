import { PrismaClient } from "@prisma/client";

// Reuse one client across hot reloads in development; Next.js re-evaluates
// modules on every change and a fresh client each time exhausts connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
