import { PrismaClient } from "@prisma/client";
import { resolveDatabaseEnv } from "../../scripts/database-env.mjs";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Accepts whichever variable names the Vercel Postgres integration created.
const { url } = resolveDatabaseEnv(process.env);

export const prisma = globalForPrisma.prisma ?? new PrismaClient(url ? { datasourceUrl: url } : undefined);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
