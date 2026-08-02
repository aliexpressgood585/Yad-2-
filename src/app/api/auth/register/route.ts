import bcrypt from "bcryptjs";

import { enforceRateLimit, handleError, ok, parseBody, ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { registerSchema } from "@/lib/validators";

export async function POST(req: Request) {
  try {
    await enforceRateLimit("register");
    const data = await parseBody(req, registerSchema);

    const existingEmail = await prisma.user.findUnique({
      where: { email: data.email },
      select: { id: true },
    });
    if (existingEmail) {
      throw new ApiError(409, "כתובת האימייל כבר רשומה במערכת", "EMAIL_TAKEN");
    }

    if (data.phone) {
      const existingPhone = await prisma.user.findUnique({
        where: { phone: data.phone },
        select: { id: true },
      });
      if (existingPhone) {
        throw new ApiError(409, "מספר הטלפון כבר רשום במערכת", "PHONE_TAKEN");
      }
    }

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone ?? null,
        passwordHash: await bcrypt.hash(data.password, 10),
      },
      select: { id: true, email: true, name: true },
    });

    return ok({ user }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
