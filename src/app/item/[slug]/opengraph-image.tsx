import { ImageResponse } from "next/og";

import { prisma } from "@/lib/db";
import { SITE } from "@/lib/site";
import { decodeSlugParam } from "@/lib/slug";
import { formatPrice } from "@/lib/utils";

export const alt = "מודעה בלוח";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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
            background: "#0f6d55",
            color: "#ffffff",
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

  const image = listing.images[0]?.url;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#fcfbf9",
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
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                marginBottom: 28,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 56,
                  height: 56,
                  borderRadius: 14,
                  background: "#0f6d55",
                  color: "#ffffff",
                  fontSize: 36,
                  fontWeight: 800,
                }}
              >
                ל
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, color: "#1f1c19" }}>
                {SITE.name}
              </div>
            </div>

            <div
              style={{
                fontSize: 52,
                fontWeight: 800,
                color: "#1f1c19",
                lineHeight: 1.15,
                display: "flex",
              }}
            >
              {listing.title.slice(0, 70)}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 64, fontWeight: 800, color: "#0f6d55", display: "flex" }}>
              {formatPrice(listing.price, { currency: listing.currency })}
            </div>
            <div style={{ fontSize: 30, color: "#6b635b", display: "flex" }}>
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
