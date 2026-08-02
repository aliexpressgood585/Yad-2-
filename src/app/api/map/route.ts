import { enforceRateLimit, handleError, ok } from "@/lib/api";
import { getCategoryBySlug, getCategoryIdsWithDescendants } from "@/lib/categories";
import { Prisma, prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const MAX_POINTS = 3000;

/**
 * נקודות למפה. מוחזר GeoJSON רזה בלבד — פרטי המודעה המלאים
 * נטענים רק כשלוחצים על סמן.
 */
export async function GET(req: Request) {
  try {
    await enforceRateLimit("search");

    const params = new URL(req.url).searchParams;
    const categorySlug = params.get("category");
    const priceMin = Number(params.get("priceMin")) || undefined;
    const priceMax = Number(params.get("priceMax")) || undefined;
    // תיבת התוחם של התצוגה הנוכחית: minLng,minLat,maxLng,maxLat
    const bbox = params.get("bbox")?.split(",").map(Number);

    const conditions: Prisma.Sql[] = [
      Prisma.sql`l."status" = 'ACTIVE'`,
      Prisma.sql`l."deletedAt" IS NULL`,
      Prisma.sql`l."displayLat" IS NOT NULL`,
      Prisma.sql`l."displayLng" IS NOT NULL`,
    ];

    if (categorySlug) {
      const category = await getCategoryBySlug(categorySlug);
      if (category) {
        const ids = await getCategoryIdsWithDescendants(category.id);
        conditions.push(Prisma.sql`l."categoryId" IN (${Prisma.join(ids)})`);
      }
    }
    if (priceMin) conditions.push(Prisma.sql`l."price" >= ${priceMin}`);
    if (priceMax) conditions.push(Prisma.sql`l."price" <= ${priceMax}`);

    if (bbox?.length === 4 && bbox.every((n) => Number.isFinite(n))) {
      const [minLng, minLat, maxLng, maxLat] = bbox as [number, number, number, number];
      conditions.push(
        Prisma.sql`l."displayLng" BETWEEN ${minLng} AND ${maxLng}`,
        Prisma.sql`l."displayLat" BETWEEN ${minLat} AND ${maxLat}`,
      );
    }

    const rows = await prisma.$queryRaw<
      {
        id: string;
        slug: string;
        title: string;
        price: number | null;
        city: string;
        lat: number;
        lng: number;
        thumb: string | null;
      }[]
    >(Prisma.sql`
      SELECT l.id, l.slug, l.title, l.price, l.city,
             l."displayLat" AS lat, l."displayLng" AS lng,
             (SELECT COALESCE(i."thumbUrl", i.url) FROM "ListingImage" i
              WHERE i."listingId" = l.id ORDER BY i."order" ASC LIMIT 1) AS thumb
      FROM "Listing" l
      WHERE ${Prisma.join(conditions, " AND ")}
      ORDER BY COALESCE(l."bumpedAt", l."publishedAt", l."createdAt") DESC
      LIMIT ${MAX_POINTS}
    `);

    return ok({
      type: "FeatureCollection",
      features: rows.map((r) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [r.lng, r.lat] },
        properties: {
          id: r.id,
          slug: r.slug,
          title: r.title,
          price: r.price,
          city: r.city,
          thumb: r.thumb,
        },
      })),
    });
  } catch (err) {
    return handleError(err);
  }
}
