import { ImageResponse } from "next/og";

import { prisma } from "@/lib/db";
import { OG, OG_CONTENT_TYPE, OG_SIZE, OgShell } from "@/lib/og";
import { SITE } from "@/lib/site";

export const alt = `${SITE.name} — ${SITE.tagline}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// מספר המודעות משתנה, אבל לא בקצב שמצדיק בנייה מחדש בכל שיתוף
export const revalidate = 3600;

/** תמונת שיתוף לדף הבית. */
export default async function OpengraphImage() {
  const count = await prisma.listing
    .count({ where: { status: "ACTIVE", deletedAt: null } })
    .catch(() => 0);

  return new ImageResponse(
    (
      <OgShell footer={SITE.tagline}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              display: "flex",
              fontSize: 76,
              fontWeight: 700,
              color: OG.ink,
              lineHeight: 1.1,
            }}
          >
            כל מה שצריך, במקום אחד נקי
          </div>
          {count > 0 ? (
            <div style={{ display: "flex", fontSize: 34, color: OG.amber, fontWeight: 700 }}>
              {count.toLocaleString("en-US")} מודעות פעילות
            </div>
          ) : null}
        </div>
      </OgShell>
    ),
    size,
  );
}
