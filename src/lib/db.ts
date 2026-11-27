import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client"

/**
 * Resolve the SQLite database URL at runtime.
 *
 * - If DATABASE_URL points at a file that actually exists, use it.
 * - Otherwise fall back to `db/custom.db` next to the running server
 *   (works in dev AND in the standalone production build, regardless
 *   of which machine the app is deployed to).
 */
function resolveDatabaseUrl(): string {
  const envUrl = process.env.DATABASE_URL
  if (envUrl && envUrl.startsWith("file:")) {
    const filePath = envUrl.slice("file:".length)
    if (fs.existsSync(filePath)) return envUrl
  }
  return `file:${path.join(process.cwd(), "db", "custom.db")}`
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: resolveDatabaseUrl() } },
    log: ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
