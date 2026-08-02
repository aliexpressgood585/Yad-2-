import { handleError, ok, parseBody, requireSession } from "@/lib/api";
import { prisma } from "@/lib/db";
import { profileSchema } from "@/lib/validators";
import { sanitizeText, slugify } from "@/lib/utils";

export async function PATCH(req: Request) {
  try {
    const session = await requireSession();
    const data = await parseBody(req, profileSchema);

    const businessName = data.businessName ? sanitizeText(data.businessName) : "";

    // slug לעמוד העסק נגזר מהשם ונשמר ייחודי
    let businessSlug: string | undefined;
    if (businessName) {
      const base = slugify(businessName) || "business";
      const taken = await prisma.user.findFirst({
        where: { businessSlug: base, NOT: { id: session.user.id } },
        select: { id: true },
      });
      businessSlug = taken ? `${base}-${session.user.id.slice(-5)}` : base;
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name: sanitizeText(data.name),
        bio: data.bio ? sanitizeText(data.bio) : null,
        avatar: data.avatar || null,
        businessName: businessName || null,
        businessAbout: data.businessAbout ? sanitizeText(data.businessAbout) : null,
        businessCity: data.businessCity || null,
        ...(businessSlug ? { businessSlug } : {}),
      },
      select: { id: true, name: true, avatar: true, businessSlug: true },
    });

    return ok({ user });
  } catch (err) {
    return handleError(err);
  }
}
