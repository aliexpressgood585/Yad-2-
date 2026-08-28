import { recordEvent } from "@/lib/analytics";
import { auth } from "@/lib/auth";
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
      select: { id: true, categoryId: true },
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

    // שלב 2 במשפך. נרשם כאן ולא בסקריפט צד-לקוח כדי שחוסם פרסומות
    // לא ימחק דווקא את הצפיות של המשתמשים המנוסים.
    const session = await auth();
    await recordEvent({
      type: "LISTING_VIEW",
      userId: session?.user?.id ?? null,
      listingId: id,
      categoryId: exists.categoryId,
    });

    return ok({ counted: true });
  } catch (err) {
    return handleError(err);
  }
}
