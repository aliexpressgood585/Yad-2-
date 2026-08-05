import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ApiError, getClientIp, handleError, ok, parseBody, requireSession } from "@/lib/api";
import { prisma } from "@/lib/db";
import { expiryDate } from "@/lib/listing-write";

const patchSchema = z.object({
  action: z.enum(["sold", "activate", "renew", "pause", "delete"]),
});

/** פעולות מהירות של בעל המודעה: סימון כנמכר, חידוש, השהיה ומחיקה. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await requireSession();
    const { action } = await parseBody(req, patchSchema);

    const listing = await prisma.listing.findFirst({
      where: { id, userId: session.user.id, deletedAt: null },
      select: { id: true, slug: true, status: true },
    });
    if (!listing) throw new ApiError(404, "המודעה לא נמצאה");

    const now = new Date();
    let data: Record<string, unknown>;

    switch (action) {
      case "sold":
        // החותמת היא מה שהופך "נמכרה" לנתון: בלעדיה יודעים ש-כן ולא מתי
        data = { status: "SOLD", soldAt: now };
        break;
      case "pause":
        data = { status: "DRAFT" };
        break;
      case "activate":
        // הפעלה מחדש מנקה את החותמת — מודעה פעילה לא נמכרה
        data = { status: "ACTIVE", publishedAt: now, expiresAt: expiryDate(now), soldAt: null };
        break;
      case "renew":
        // חידוש גם מרענן את מיקום המודעה ברשימות
        data = { status: "ACTIVE", expiresAt: expiryDate(now), bumpedAt: now };
        break;
      case "delete":
        data = { deletedAt: now, status: "EXPIRED" };
        break;
    }

    await prisma.$transaction([
      prisma.listing.update({ where: { id }, data }),
      prisma.auditLog.create({
        data: {
          actorId: session.user.id,
          action: `listing.${action}`,
          entityType: "Listing",
          entityId: id,
          ip: await getClientIp(),
        },
      }),
    ]);

    revalidatePath(`/item/${listing.slug}`);
    revalidatePath("/my");

    return ok({ id, action });
  } catch (err) {
    return handleError(err);
  }
}

/** מחיקה רכה של מודעה. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await requireSession();

    const result = await prisma.listing.updateMany({
      where: { id, userId: session.user.id, deletedAt: null },
      data: { deletedAt: new Date(), status: "EXPIRED" },
    });
    if (result.count === 0) throw new ApiError(404, "המודעה לא נמצאה");

    revalidatePath("/my");
    return ok({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
