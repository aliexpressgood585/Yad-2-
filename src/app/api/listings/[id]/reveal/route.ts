import { recordEvent } from "@/lib/analytics";
import { auth } from "@/lib/auth";
import { enforceRateLimit, getClientIp, handleError, hashIp, ok, ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";

/**
 * חשיפת מספר הטלפון של המוכר.
 * מוגבל בקצב ומתועד — כדי למנוע גרידה של מאגר המספרים.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await auth();
    const ip = await getClientIp();
    const identifier = session?.user?.id ?? ip;

    await enforceRateLimit("revealPhone", identifier);

    const listing = await prisma.listing.findFirst({
      where: { id, deletedAt: null, status: { not: "BANNED" } },
      select: {
        id: true,
        categoryId: true,
        contactPhone: true,
        user: { select: { phone: true } },
      },
    });
    if (!listing) throw new ApiError(404, "המודעה לא נמצאה");

    const phone = listing.contactPhone ?? listing.user.phone;
    if (!phone) return ok({ phone: null });

    const ipHash = hashIp(ip);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // תיעוד + מוני סטטיסטיקה. לא מעכב את התשובה מבחינת נכונות,
    // אבל נשמר באותה טרנזקציה כדי שהמונים לא יסטו.
    await prisma.$transaction([
      prisma.phoneReveal.create({
        data: { listingId: id, userId: session?.user?.id ?? null, ipHash },
      }),
      prisma.listing.update({
        where: { id },
        data: { contactRevealCount: { increment: 1 } },
      }),
      prisma.listingDailyStat.upsert({
        where: { listingId_day: { listingId: id, day: today } },
        create: { listingId: id, day: today, reveals: 1 },
        update: { reveals: { increment: 1 } },
      }),
    ]);

    // שלב 3 במשפך
    await recordEvent({
      type: "PHONE_REVEAL",
      userId: session?.user?.id ?? null,
      listingId: id,
      categoryId: listing.categoryId,
    });

    return ok({ phone });
  } catch (err) {
    return handleError(err);
  }
}
