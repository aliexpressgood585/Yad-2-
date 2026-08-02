import { handleError, ok } from "@/lib/api";
import { prisma } from "@/lib/db";
import { formatAttributeValue } from "@/lib/format";
import { MAX_COMPARE } from "@/lib/site";

export const dynamic = "force-dynamic";

/** מודעות מלאות (כולל מפרט) להשוואה. */
export async function GET(req: Request) {
  try {
    const ids = (new URL(req.url).searchParams.get("ids") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, MAX_COMPARE);

    if (!ids.length) return ok({ items: [] });

    const listings = await prisma.listing.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: {
        id: true,
        slug: true,
        title: true,
        price: true,
        currency: true,
        city: true,
        neighborhood: true,
        status: true,
        viewCount: true,
        publishedAt: true,
        createdAt: true,
        category: { select: { name: true } },
        user: {
          select: { id: true, name: true, ratingAvg: true, ratingCount: true, verifiedAt: true },
        },
        images: { orderBy: { order: "asc" }, take: 1, select: { url: true, thumbUrl: true } },
        attributes: {
          select: {
            valueText: true,
            valueNumber: true,
            valueBool: true,
            attribute: { select: { key: true, label: true, unit: true, order: true, type: true } },
            value: { select: { label: true } },
          },
        },
      },
    });

    const byId = new Map(listings.map((l) => [l.id, l]));

    const items = ids
      .map((id) => byId.get(id))
      .filter((l): l is NonNullable<typeof l> => Boolean(l))
      .map((l) => {
        // ריכוז ערכי המפרט לפי מפתח; ערכים מרובים מאוחדים לפסיקים
        const specs: Record<string, { label: string; value: string; order: number }> = {};
        for (const a of l.attributes) {
          const key = a.attribute.key;
          const value = formatAttributeValue(a);
          if (!value) continue;

          specs[key] = specs[key]
            ? { ...specs[key]!, value: `${specs[key]!.value}, ${value}` }
            : { label: a.attribute.label, value, order: a.attribute.order };
        }

        return {
          id: l.id,
          slug: l.slug,
          title: l.title,
          price: l.price,
          currency: l.currency,
          city: l.city,
          neighborhood: l.neighborhood,
          status: l.status,
          viewCount: l.viewCount,
          categoryName: l.category.name,
          date: (l.publishedAt ?? l.createdAt).toISOString(),
          imageUrl: l.images[0]?.thumbUrl ?? l.images[0]?.url ?? null,
          seller: {
            id: l.user.id,
            name: l.user.name,
            ratingAvg: l.user.ratingAvg,
            ratingCount: l.user.ratingCount,
            verified: Boolean(l.user.verifiedAt),
          },
          specs,
        };
      });

    return ok({ items });
  } catch (err) {
    return handleError(err);
  }
}
