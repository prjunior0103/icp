import { PrismaClient } from "../generated/prisma";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient(): PrismaClient {
  const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || "file:./dev.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;

  const adapterConfig = authToken ? { url, authToken } : { url };
  const adapter = new PrismaLibSql(adapterConfig);

  return new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
