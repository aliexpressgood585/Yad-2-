import { auth } from "@/lib/auth";
import { enforceRateLimit, getClientIp, handleError, ok, parseBody, ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { reportSchema } from "@/lib/validators";

export async function POST(req: Request) {
  try {
    const session = await auth();
    const identifier = session?.user?.id ?? (await getClientIp());
    await enforceRateLimit("report", identifier);

    const data = await parseBody(req, reportSchema);

    const listing = await prisma.listing.findFirst({
      where: { id: data.listingId, deletedAt: null },
      select: { id: true },
    });
    if (!listing) throw new ApiError(404, "המודעה לא נמצאה");

    // דיווח חוזר של אותו משתמש על אותה מודעה לא יוצר רשומה נוספת
    if (session?.user?.id) {
      const existing = await prisma.report.findFirst({
        where: { listingId: data.listingId, authorId: session.user.id, status: "OPEN" },
        select: { id: true },
      });
      if (existing) return ok({ reported: true, duplicate: true });
    }

    await prisma.report.create({
      data: {
        listingId: data.listingId,
        authorId: session?.user?.id ?? null,
        reason: data.reason,
        details: data.details || null,
      },
    });

    return ok({ reported: true }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
