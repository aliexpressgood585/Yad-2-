import { z } from "zod";

import { enforceRateLimit, handleError, ok, parseBody, requireSession } from "@/lib/api";
import { prisma } from "@/lib/db";

const bodySchema = z.object({ listingId: z.string().min(1) });

/** מזהי המודעות ששמורות אצל המשתמש המחובר. */
export async function GET() {
  try {
    const session = await requireSession();
    const rows = await prisma.favorite.findMany({
      where: { userId: session.user.id },
      select: { listingId: true },
    });
    return ok({ ids: rows.map((r) => r.listingId) });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    await enforceRateLimit("favorite", session.user.id);
    const { listingId } = await parseBody(req, bodySchema);

    await prisma.$transaction([
      prisma.favorite.upsert({
        where: { userId_listingId: { userId: session.user.id, listingId } },
        create: { userId: session.user.id, listingId },
        update: {},
      }),
      prisma.listing.update({
        where: { id: listingId },
        data: { favoriteCount: { increment: 1 } },
      }),
    ]);

    return ok({ favorited: true });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireSession();
    const { listingId } = await parseBody(req, bodySchema);

    const deleted = await prisma.favorite.deleteMany({
      where: { userId: session.user.id, listingId },
    });
    if (deleted.count > 0) {
      await prisma.listing.update({
        where: { id: listingId },
        data: { favoriteCount: { decrement: 1 } },
      });
    }

    return ok({ favorited: false });
  } catch (err) {
    return handleError(err);
  }
}
