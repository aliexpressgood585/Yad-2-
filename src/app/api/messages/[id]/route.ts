import { ApiError, handleError, ok, requireSession } from "@/lib/api";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** הודעות חדשות בשיחה מאז חותמת זמן נתונה (פולינג של חוט הצ'אט). */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await requireSession();
    const userId = session.user.id;

    const conversation = await prisma.conversation.findFirst({
      where: { id, OR: [{ buyerId: userId }, { sellerId: userId }] },
      select: { id: true, sellerId: true },
    });
    if (!conversation) throw new ApiError(404, "השיחה לא נמצאה");

    const afterRaw = new URL(req.url).searchParams.get("after");
    const after = afterRaw ? new Date(afterRaw) : null;
    const validAfter = after && !Number.isNaN(after.getTime()) ? after : null;

    const messages = await prisma.message.findMany({
      where: {
        conversationId: id,
        ...(validAfter ? { createdAt: { gt: validAfter } } : {}),
      },
      orderBy: { createdAt: "asc" },
      take: 100,
      select: { id: true, body: true, senderId: true, createdAt: true },
    });

    // צפייה בשיחה מסמנת אותה כנקראה עבור הצד שצופה
    if (messages.length) {
      const isSeller = conversation.sellerId === userId;
      await prisma.conversation.update({
        where: { id },
        data: isSeller ? { sellerReadAt: new Date() } : { buyerReadAt: new Date() },
      });
    }

    return ok({
      messages: messages.map((m) => ({
        id: m.id,
        body: m.body,
        senderId: m.senderId,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    return handleError(err);
  }
}
