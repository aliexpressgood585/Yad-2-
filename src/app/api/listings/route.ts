import {
  ApiError,
  enforceRateLimit,
  getClientIp,
  handleError,
  ok,
  parseBody,
  requireSession,
} from "@/lib/api";
import { prisma } from "@/lib/db";
import {
  buildAttributeRows,
  deriveListingFields,
  expiryDate,
  runFraudChecks,
  uniqueSlug,
} from "@/lib/listing-write";
import { listingInputSchema, publishSchema } from "@/lib/validators";
import { sanitizeText } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const createSchema = z.object({
  /** `draft` שומר בלי אימות מלא, `publish` מפרסם באוויר */
  mode: z.enum(["draft", "publish"]).default("publish"),
  listingId: z.string().optional(),
  data: z.unknown(),
});

const MAX_ACTIVE_DRAFTS = 20;

/** יצירה או עדכון של מודעה (טיוטה או פרסום). */
export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const body = await parseBody(req, createSchema);
    const publishing = body.mode === "publish";

    if (publishing) {
      await enforceRateLimit("publish", session.user.id);
    }

    // פרסום ראשון מחייב אימות טלפון — קו ההגנה המרכזי מול ספאם
    if (publishing && !session.user.phoneVerified) {
      throw new ApiError(
        403,
        "יש לאמת מספר טלפון לפני פרסום מודעה",
        "PHONE_VERIFICATION_REQUIRED",
      );
    }

    const schema = publishing ? publishSchema : listingInputSchema;
    const input = schema.parse(body.data);

    const category = await prisma.category.findUnique({
      where: { id: input.categoryId },
      select: { id: true, isActive: true },
    });
    if (!category?.isActive) throw new ApiError(422, "הקטגוריה שנבחרה אינה זמינה");

    const { rows, labels, missing } = await buildAttributeRows(
      input.categoryId,
      input.attributes,
    );
    if (publishing && missing.length) {
      throw new ApiError(422, `חסרים שדות חובה: ${missing.join(", ")}`, "MISSING_ATTRIBUTES");
    }

    const title = sanitizeText(input.title);
    const description = sanitizeText(input.description);

    // עדכון מודעה קיימת
    if (body.listingId) {
      const existing = await prisma.listing.findFirst({
        where: { id: body.listingId, userId: session.user.id, deletedAt: null },
        select: { id: true, slug: true, price: true, status: true },
      });
      if (!existing) throw new ApiError(404, "המודעה לא נמצאה");

      const derived = await deriveListingFields(
        { ...input, title, description },
        labels,
        existing.slug,
        input.attributes,
      );

      const priceChanged =
        input.price !== null && input.price !== existing.price && existing.status === "ACTIVE";

      await prisma.$transaction([
        prisma.listing.update({
          where: { id: existing.id },
          data: {
            categoryId: input.categoryId,
            title,
            description,
            price: input.price,
            isNegotiable: input.isNegotiable,
            city: input.city,
            neighborhood: input.neighborhood || null,
            address: input.address || null,
            contactPhone: input.contactPhone ?? null,
            contactName: input.contactName || null,
            allowChat: input.allowChat,
            ...derived,
            ...(publishing && existing.status !== "ACTIVE"
              ? {
                  status: "ACTIVE" as const,
                  publishedAt: new Date(),
                  expiresAt: expiryDate(),
                }
              : {}),
          },
        }),
        prisma.listingAttribute.deleteMany({ where: { listingId: existing.id } }),
        ...(rows.length
          ? [
              prisma.listingAttribute.createMany({
                data: rows.map((r) => ({ ...r, listingId: existing.id })),
              }),
            ]
          : []),
        prisma.listingImage.deleteMany({ where: { listingId: existing.id } }),
        ...(input.images.length
          ? [
              prisma.listingImage.createMany({
                data: input.images.map((img, i) => ({
                  listingId: existing.id,
                  url: img.url,
                  thumbUrl: img.thumbUrl ?? null,
                  blurhash: img.blurhash ?? null,
                  width: img.width ?? null,
                  height: img.height ?? null,
                  phash: img.phash ?? null,
                  order: i,
                })),
              }),
            ]
          : []),
        ...(priceChanged
          ? [
              prisma.priceHistory.create({
                data: { listingId: existing.id, price: input.price! },
              }),
            ]
          : []),
      ]);

      await runFraudChecks(existing.id);
      revalidatePath(`/item/${existing.slug}`);

      return ok({ id: existing.id, slug: existing.slug, status: publishing ? "ACTIVE" : existing.status });
    }

    // מודעה חדשה
    if (!publishing) {
      const drafts = await prisma.listing.count({
        where: { userId: session.user.id, status: "DRAFT", deletedAt: null },
      });
      if (drafts >= MAX_ACTIVE_DRAFTS) {
        throw new ApiError(409, `יש לך כבר ${MAX_ACTIVE_DRAFTS} טיוטות. מחקו טיוטה כדי להוסיף חדשה.`);
      }
    }

    const slug = await uniqueSlug(title);
    const derived = await deriveListingFields(
      { ...input, title, description },
      labels,
      slug,
      input.attributes,
    );
    const now = new Date();

    const listing = await prisma.listing.create({
      data: {
        slug,
        userId: session.user.id,
        categoryId: input.categoryId,
        title,
        description,
        price: input.price,
        isNegotiable: input.isNegotiable,
        status: publishing ? "ACTIVE" : "DRAFT",
        city: input.city,
        neighborhood: input.neighborhood || null,
        address: input.address || null,
        contactPhone: input.contactPhone ?? session.user.phone ?? null,
        contactName: input.contactName || null,
        allowChat: input.allowChat,
        publishedAt: publishing ? now : null,
        expiresAt: publishing ? expiryDate(now) : null,
        ...derived,
        images: {
          create: input.images.map((img, i) => ({
            url: img.url,
            thumbUrl: img.thumbUrl ?? null,
            blurhash: img.blurhash ?? null,
            width: img.width ?? null,
            height: img.height ?? null,
            phash: img.phash ?? null,
            order: i,
          })),
        },
        ...(rows.length ? { attributes: { create: rows } } : {}),
        ...(publishing && input.price !== null
          ? { priceHistory: { create: { price: input.price } } }
          : {}),
      },
      select: { id: true, slug: true, status: true },
    });

    if (publishing) {
      await runFraudChecks(listing.id);
      await prisma.auditLog.create({
        data: {
          actorId: session.user.id,
          action: "listing.publish",
          entityType: "Listing",
          entityId: listing.id,
          ip: await getClientIp(),
        },
      });
    }

    return ok(listing, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
