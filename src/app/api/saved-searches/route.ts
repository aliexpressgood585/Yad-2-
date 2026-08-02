import { z } from "zod";

import { handleError, ok, parseBody, requireSession, ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { savedSearchSchema } from "@/lib/validators";

const deleteSchema = z.object({ id: z.string().min(1) });
const updateSchema = z.object({
  id: z.string().min(1),
  frequency: z.enum(["OFF", "INSTANT", "DAILY", "WEEKLY"]).optional(),
  name: z.string().trim().min(2).max(60).optional(),
});

const MAX_SAVED_SEARCHES = 50;

export async function GET() {
  try {
    const session = await requireSession();
    const searches = await prisma.savedSearch.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });
    return ok({ searches });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const data = await parseBody(req, savedSearchSchema);

    const count = await prisma.savedSearch.count({ where: { userId: session.user.id } });
    if (count >= MAX_SAVED_SEARCHES) {
      throw new ApiError(
        409,
        `אפשר לשמור עד ${MAX_SAVED_SEARCHES} חיפושים. מחקו חיפוש קיים כדי להוסיף חדש.`,
      );
    }

    const search = await prisma.savedSearch.create({
      data: {
        userId: session.user.id,
        name: data.name,
        filters: data.filters as object,
        frequency: data.frequency,
        lastSeenAt: new Date(),
      },
    });

    return ok({ search }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireSession();
    const { id, ...rest } = await parseBody(req, updateSchema);

    const result = await prisma.savedSearch.updateMany({
      where: { id, userId: session.user.id },
      data: rest,
    });
    if (result.count === 0) throw new ApiError(404, "החיפוש לא נמצא");

    return ok({ updated: true });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireSession();
    const { id } = await parseBody(req, deleteSchema);

    const result = await prisma.savedSearch.deleteMany({
      where: { id, userId: session.user.id },
    });
    if (result.count === 0) throw new ApiError(404, "החיפוש לא נמצא");

    return ok({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
