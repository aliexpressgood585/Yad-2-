import {
  ApiError,
  enforceRateLimit,
  handleError,
  ok,
  parseBody,
  requireSession,
} from "@/lib/api";
import { recordEvent } from "@/lib/analytics";
import { prisma } from "@/lib/db";
import { notifyNewMessage } from "@/lib/notification-triggers";
import { messageSchema, replySchema } from "@/lib/validators";
import { sanitizeText } from "@/lib/utils";

/** פתיחת שיחה חדשה על מודעה (או שליחה לשיחה קיימת). */
export async function POST(req: Request) {
  try {
    const session = await requireSession();
    await enforceRateLimit("message", session.user.id);

    const { listingId, body } = await parseBody(req, messageSchema);
    const clean = sanitizeText(body);
    if (!clean) throw new ApiError(422, "לא ניתן לשלוח הודעה ריקה");

    const listing = await prisma.listing.findFirst({
      where: { id: listingId, deletedAt: null },
      select: {
        id: true,
        userId: true,
        categoryId: true,
        title: true,
        slug: true,
        allowChat: true,
      },
    });
    if (!listing) throw new ApiError(404, "המודעה לא נמצאה");
    if (!listing.allowChat) {
      throw new ApiError(403, "המוכר בחר לקבל פניות בטלפון בלבד");
    }
    if (listing.userId === session.user.id) {
      throw new ApiError(400, "לא ניתן לשלוח הודעה למודעה שלך");
    }

    const conversation = await prisma.conversation.upsert({
      where: { listingId_buyerId: { listingId, buyerId: session.user.id } },
      create: {
        listingId,
        buyerId: session.user.id,
        sellerId: listing.userId,
        lastMessageAt: new Date(),
        buyerReadAt: new Date(),
      },
      update: { lastMessageAt: new Date(), buyerArchived: false, sellerArchived: false },
      select: { id: true, sellerId: true },
    });

    const message = await prisma.message.create({
      data: { conversationId: conversation.id, senderId: session.user.id, body: clean },
    });

    await notifyNewMessage({
      recipientId: conversation.sellerId,
      messageId: message.id,
      senderName: session.user.name ?? "משתמש",
      conversationId: conversation.id,
      listingTitle: listing.title,
      preview: clean,
    });

    /*
     * שלב 4 במשפך — פנייה.
     *
     * נרשם רק ב-POST ולא ב-PUT: POST הוא פתיחת פנייה של קונה למוכר,
     * ו-PUT הוא תגובה בשיחה שכבר קיימת. ספירת כל הודעה הייתה הופכת
     * שיחה ארוכה אחת לארבעים "פניות", וזה בדיוק המספר שנראה יפה
     * ואומר כלום.
     */
    await recordEvent({
      type: "CONTACT",
      userId: session.user.id,
      listingId: listing.id,
      categoryId: listing.categoryId,
    });

    return ok({ conversationId: conversation.id }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}

/** תגובה בשיחה קיימת. */
export async function PUT(req: Request) {
  try {
    const session = await requireSession();
    await enforceRateLimit("message", session.user.id);

    const { conversationId, body } = await parseBody(req, replySchema);
    const clean = sanitizeText(body);
    if (!clean) throw new ApiError(422, "לא ניתן לשלוח הודעה ריקה");

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        buyerId: true,
        sellerId: true,
        listing: { select: { title: true } },
      },
    });
    if (!conversation) throw new ApiError(404, "השיחה לא נמצאה");

    const userId = session.user.id;
    if (conversation.buyerId !== userId && conversation.sellerId !== userId) {
      throw new ApiError(403, "אין לך גישה לשיחה הזו");
    }

    const isBuyer = conversation.buyerId === userId;
    const recipientId = isBuyer ? conversation.sellerId : conversation.buyerId;

    const [message] = await prisma.$transaction([
      prisma.message.create({
        data: { conversationId, senderId: userId, body: clean },
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: new Date(),
          // הצד ששלח קרא בהגדרה את כל השיחה
          ...(isBuyer ? { buyerReadAt: new Date() } : { sellerReadAt: new Date() }),
          buyerArchived: false,
          sellerArchived: false,
        },
      }),
    ]);

    await notifyNewMessage({
      recipientId,
      messageId: message.id,
      senderName: session.user.name ?? "משתמש",
      conversationId,
      listingTitle: conversation.listing.title,
      preview: clean,
    });

    return ok({
      message: {
        id: message.id,
        body: message.body,
        senderId: message.senderId,
        createdAt: message.createdAt.toISOString(),
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
