import { ImageResponse } from "next/og";

import { prisma } from "@/lib/db";
import { OG, OG_CONTENT_TYPE, OG_SIZE, OgWordmark } from "@/lib/og";
import { SITE, absoluteUrl } from "@/lib/site";
import { decodeSlugParam } from "@/lib/slug";
import { formatPrice } from "@/lib/format";
import { priceMetersFor } from "@/lib/price-meter";

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
      id: true,
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
            color: OG.surface,
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

  /*
   * מד המחיר נוסע עם השיתוף.
   *
   * מישהו שולח מודעה בוואטסאפ, והמקבל רואה לא רק את המחיר אלא גם
   * איפה הוא יושב מול השוק — כלומר בדיוק את הדבר שמייחד את הלוח,
   * אצל אדם שעוד לא ביקר בו. זו התפוצה הזולה ביותר שיש, והיא משווקת
   * את הפיצ'ר ולא את הלוגו.
   *
   * אין קריאה = אין סקאלה. תמונת שיתוף אינה מקום שבו מותר להמציא.
   */
  const meter = (await priceMetersFor([listing.id])).get(listing.id) ?? null;
  const needle = meter ? Math.min(96, Math.max(4, meter.percentile * 100)) : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: OG.bone,
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
                color: OG.ink,
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

            {needle !== null && meter ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* הלוחית: שנתה ראשית כל רבע, בדיוק כמו ברכיב החי */}
                <div
                  style={{
                    display: "flex",
                    position: "relative",
                    width: 420,
                    height: 34,
                    background: OG.plate,
                  }}
                >
                  {[0, 25, 50, 75, 100].map((pct) => (
                    <div
                      key={pct}
                      style={{
                        position: "absolute",
                        right: `${pct}%`,
                        bottom: 0,
                        width: 2,
                        height: 34,
                        background: OG.scaleHair,
                        display: "flex",
                      }}
                    />
                  ))}
                  <div
                    style={{
                      position: "absolute",
                      right: `${needle}%`,
                      bottom: 0,
                      width: 5,
                      height: 34,
                      background: OG.needle,
                      display: "flex",
                    }}
                  />
                </div>
                <div style={{ fontSize: 26, color: OG.muted, display: "flex" }}>
                  {Math.abs(meter.deltaPct)}% {meter.deltaPct < 0 ? "מתחת לחציון" : "מעל החציון"} ·{" "}
                  {meter.sample} מודעות דומות
                </div>
              </div>
            ) : null}
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
