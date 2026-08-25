import { ImageResponse } from "next/og";

import { prisma } from "@/lib/db";
import { bidi, bidiLines, OG, OG_CONTENT_TYPE, OG_SIZE, ogOptions, OgShell } from "@/lib/og";
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
      <OgShell footer={'לוח מודעות שמודד — רכב, נדל"ן, יד שנייה ועוד'}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/*
            * הכותרת היא הסלוגן החי מ-`lib/brand` ולא מחרוזת מודבקת.
            * הגרסה הקודמת נשאה את "כל מה שצריך, במקום אחד נקי" —
            * משפט שהוחלף באתר עצמו לפני שלוש החלפות שם, ושרד רק כאן.
            * זו בדיוק הסיבה שהמותג חי בקובץ אחד.
            */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 76,
              fontWeight: 700,
              color: OG.ink,
              lineHeight: 1.1,
            }}
          >
            {bidiLines(SITE.tagline, 20).map((line, i) => (
              <div key={i} style={{ display: "flex" }}>
                {line}
              </div>
            ))}
          </div>
          {count > 0 ? (
            <div style={{ display: "flex", fontSize: 34, color: OG.amber, fontWeight: 700 }}>
              {bidi(`${count.toLocaleString("en-US")} מודעות פעילות`)}
            </div>
          ) : null}
        </div>
      </OgShell>
    ),
    await ogOptions(),
  );
}
