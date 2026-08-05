import { ImageResponse } from "next/og";

import { prisma } from "@/lib/db";
import { getCategoryBySlug, getCategoryIdsWithDescendants } from "@/lib/categories";
import { OG, OG_CONTENT_TYPE, OG_SIZE, OgShell } from "@/lib/og";
import { SITE } from "@/lib/site";
import { decodeSlugParam } from "@/lib/slug";

export const alt = `קטגוריה ב${SITE.name}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export const revalidate = 3600;

/** תמונת שיתוף לדף קטגוריה: שם הקטגוריה, כמה מודעות ומאיזה מחיר. */
export default async function OpengraphImage({
  params,
}: {
  params: { category: string };
}) {
  const category = await getCategoryBySlug(decodeSlugParam(params.category));

  if (!category) {
    return new ImageResponse(
      (
        <OgShell>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 700, color: OG.ink }}>
            {SITE.name}
          </div>
        </OgShell>
      ),
      size,
    );
  }

  const ids = await getCategoryIdsWithDescendants(category.id);
  const stats = await prisma.listing
    .aggregate({
      where: { status: "ACTIVE", deletedAt: null, categoryId: { in: ids } },
      _count: { _all: true },
      _min: { price: true },
    })
    .catch(() => null);

  const count = stats?._count._all ?? 0;
  const min = stats?._min.price ?? null;

  return new ImageResponse(
    (
      <OgShell footer={SITE.tagline}>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              display: "flex",
              fontSize: 76,
              fontWeight: 700,
              color: OG.ink,
              lineHeight: 1.1,
            }}
          >
            {category.namePlural ?? category.name}
          </div>

          {count > 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: OG.amber }}>
                {count.toLocaleString("en-US")} מודעות
              </div>
              {min !== null ? (
                <>
                  <div style={{ display: "flex", fontSize: 34, color: OG.hair }}>·</div>
                  <div style={{ display: "flex", fontSize: 34, color: OG.muted }}>
                    {`החל מ-₪${min.toLocaleString("en-US")}`}
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </OgShell>
    ),
    size,
  );
}
