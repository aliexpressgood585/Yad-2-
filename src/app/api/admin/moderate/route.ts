import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ApiError, getClientIp, handleError, ok, parseBody, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/db";
import { createNotification } from "@/lib/notifications";

const schema = z.object({
  action: z.enum([
    "dismiss",
    "clear_flags",
    "ban_listing",
    "unban_listing",
    "block_user",
    "unblock_user",
  ]),
  reportId: z.string().optional(),
  listingId: z.string().optional(),
  userId: z.string().optional(),
  note: z.string().max(500).optional(),
});

/** פעולות מודרציה. כל פעולה נרשמת ביומן הפעולות. */
export async function POST(req: Request) {
  try {
    const session = await requireAdmin();
    const input = await parseBody(req, schema);
    const ip = await getClientIp();
    const actorId = session.user.id;

    const log = (action: string, entityType: string, entityId: string, meta?: object) =>
      prisma.auditLog.create({
        data: { actorId, action, entityType, entityId, ip, meta: meta ?? undefined },
      });

    switch (input.action) {
      case "dismiss": {
        if (!input.reportId) throw new ApiError(400, "חסר מזהה דיווח");
        await prisma.report.update({
          where: { id: input.reportId },
          data: { status: "DISMISSED", handledAt: new Date() },
        });
        await log("moderation.dismiss_report", "Report", input.reportId);
        break;
      }

      case "clear_flags": {
        if (!input.listingId) throw new ApiError(400, "חסר מזהה מודעה");
        await prisma.$transaction([
          prisma.fraudFlag.deleteMany({ where: { listingId: input.listingId } }),
          prisma.listing.update({
            where: { id: input.listingId },
            data: { fraudScore: 0 },
          }),
        ]);
        await log("moderation.clear_flags", "Listing", input.listingId);
        break;
      }

      case "ban_listing": {
        if (!input.listingId) throw new ApiError(400, "חסר מזהה מודעה");
        const listing = await prisma.listing.update({
          where: { id: input.listingId },
          data: { status: "BANNED" },
          select: { slug: true, title: true, userId: true },
        });

        if (input.reportId) {
          await prisma.report.update({
            where: { id: input.reportId },
            data: { status: "RESOLVED", handledAt: new Date() },
          });
        }
        // שאר הדיווחים על אותה מודעה נסגרים יחד איתה
        await prisma.report.updateMany({
          where: { listingId: input.listingId, status: "OPEN" },
          data: { status: "RESOLVED", handledAt: new Date() },
        });

        await log("moderation.ban_listing", "Listing", input.listingId, {
          note: input.note,
        });

        await createNotification({
          userId: listing.userId,
          type: "LISTING_BANNED",
          title: "המודעה שלך הוסרה",
          body: `המודעה "${listing.title}" הוסרה מהאתר לאחר בדיקה. לפרטים ניתן לפנות לתמיכה.`,
          url: "/my",
          email: true,
        });

        revalidatePath(`/item/${listing.slug}`);
        break;
      }

      case "unban_listing": {
        if (!input.listingId) throw new ApiError(400, "חסר מזהה מודעה");
        const listing = await prisma.listing.update({
          where: { id: input.listingId },
          data: { status: "ACTIVE" },
          select: { slug: true, title: true, userId: true },
        });
        await log("moderation.unban_listing", "Listing", input.listingId);
        await createNotification({
          userId: listing.userId,
          type: "LISTING_APPROVED",
          title: "המודעה שלך הוחזרה לאוויר",
          body: `המודעה "${listing.title}" נבדקה ואושרה מחדש.`,
          url: "/my",
        });
        revalidatePath(`/item/${listing.slug}`);
        break;
      }

      case "block_user": {
        if (!input.userId) throw new ApiError(400, "חסר מזהה משתמש");
        if (input.userId === actorId) {
          throw new ApiError(400, "לא ניתן לחסום את עצמך");
        }
        await prisma.$transaction([
          prisma.user.update({
            where: { id: input.userId },
            data: { isBlocked: true },
          }),
          prisma.listing.updateMany({
            where: { userId: input.userId, deletedAt: null },
            data: { status: "BANNED" },
          }),
          prisma.report.updateMany({
            where: { listing: { userId: input.userId }, status: "OPEN" },
            data: { status: "RESOLVED", handledAt: new Date() },
          }),
        ]);
        await log("moderation.block_user", "User", input.userId, { note: input.note });
        break;
      }

      case "unblock_user": {
        if (!input.userId) throw new ApiError(400, "חסר מזהה משתמש");
        await prisma.user.update({
          where: { id: input.userId },
          data: { isBlocked: false },
        });
        await log("moderation.unblock_user", "User", input.userId);
        break;
      }
    }

    revalidatePath("/admin/moderation");
    return ok({ done: true, action: input.action });
  } catch (err) {
    return handleError(err);
  }
}
