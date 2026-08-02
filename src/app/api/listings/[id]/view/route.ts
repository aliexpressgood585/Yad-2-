import { handleError, ok } from "@/lib/api";
import { prisma } from "@/lib/db";

/** רישום צפייה במודעה. נקרא פעם אחת לכל טעינת דף מצד הלקוח. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const exists = await prisma.listing.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!exists) return ok({ counted: false });

    await prisma.$transaction([
      prisma.listing.update({ where: { id }, data: { viewCount: { increment: 1 } } }),
      prisma.listingDailyStat.upsert({
        where: { listingId_day: { listingId: id, day: today } },
        create: { listingId: id, day: today, views: 1 },
        update: { views: { increment: 1 } },
      }),
    ]);

    return ok({ counted: true });
  } catch (err) {
    return handleError(err);
  }
}
