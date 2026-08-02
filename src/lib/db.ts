import { PrismaClient } from "@prisma/client";

/**
 * מופע יחיד של Prisma. ב-dev, Next מרענן מודולים ולכן שומרים את המופע
 * על ה-globalThis כדי לא לפתוח בריכות חיבורים חדשות בכל hot reload.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export { Prisma } from "@prisma/client";
