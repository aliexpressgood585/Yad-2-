import { ImageResponse } from "next/og";

import { prisma } from "@/lib/db";
import { OG, OG_CONTENT_TYPE, OG_SIZE, OgWordmark } from "@/lib/og";
import { SITE, absoluteUrl } from "@/lib/site";
import { decodeSlugParam } from "@/lib/slug";
import { formatPrice } from "@/lib/format";

export const alt = "מודעה בלוח";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/**
 * תמונת שיתוף דינמית למודעה.
 * נבנית ב-Edge עם next/og — ללא גופן חיצוני, כדי לא להיכשל
 * כשאין גישה לרשת בזמן הבנייה.
 */
export default async function OpengraphImage({
  params,
}: {
  params: { slug: string };
}) {
  const listing = await prisma.listing.findFirst({
    where: { slug: decodeSlugParam(params.slug), deletedAt: null },
    select: {
      title: true,
      price: true,
      currency: true,
      city: true,
      neighborhood: true,
      category: { select: { name: true } },
      images: { orderBy: { order: "asc" }, take: 1, select: { url: true } },
    },
  });

  if (!listing) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: OG.amber,
            color: OG.graphite,
            fontSize: 72,
            fontWeight: 700,
          }}
        >
          {SITE.name}
        </div>
      ),
      size,
    );
  }

  const image = listing.images[0]?.url ? absoluteUrl(listing.images[0].url) : undefined;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: OG.graphite,
          direction: "rtl",
        }}
      >
        {image ? (
          <div style={{ display: "flex", width: 520, height: "100%" }}>
            <img
              src={image}
              alt=""
              width={520}
              height={630}
              style={{ objectFit: "cover", width: 520, height: 630 }}
            />
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            flex: 1,
            padding: 56,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", marginBottom: 28 }}>
              <OgWordmark />
            </div>

            <div
              style={{
                fontSize: 52,
                fontWeight: 700,
                color: OG.bone,
                lineHeight: 1.15,
                display: "flex",
              }}
            >
              {listing.title.slice(0, 70)}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 64, fontWeight: 700, color: OG.amber, display: "flex" }}>
              {formatPrice(listing.price, { currency: listing.currency })}
            </div>
            <div style={{ fontSize: 30, color: OG.muted, display: "flex" }}>
              {listing.city}
              {listing.neighborhood ? `, ${listing.neighborhood}` : ""} ·{" "}
              {listing.category.name}
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
