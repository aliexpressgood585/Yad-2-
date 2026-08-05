import type { CSSProperties, ReactNode } from "react";

import { PALETTE } from "@/lib/palette";
import { SITE } from "@/lib/site";

/**
 * חלקים משותפים לתמונות השיתוף (`opengraph-image.tsx`).
 * הצבעים מגיעים מ-@/lib/palette כי Satori לא מכיר טוקני CSS.
 */
export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png";

export const OG = PALETTE;

const shellStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  background: OG.bone,
  direction: "rtl",
  padding: 64,
};

/** לוגו טקסטואלי — אותו סימן שמופיע בכותרת האתר. */
export function OgWordmark({ scale = 1 }: { scale?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 * scale }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 56 * scale,
          height: 56 * scale,
          borderRadius: 14 * scale,
          background: OG.amber,
          color: "#ffffff",
          fontSize: 36 * scale,
          fontWeight: 700,
        }}
      >
        ל
      </div>
      <div style={{ fontSize: 32 * scale, fontWeight: 700, color: OG.ink }}>
        {SITE.name}
      </div>
    </div>
  );
}

/** מסגרת אחידה: לוגו למעלה, תוכן באמצע, שורת רגל למטה. */
export function OgShell({
  children,
  footer,
}: {
  children: ReactNode;
  footer?: string;
}) {
  return (
    <div style={shellStyle}>
      <OgWordmark />
      {children}
      <div style={{ display: "flex", fontSize: 26, color: OG.muted }}>
        {footer ?? SITE.tagline}
      </div>
    </div>
  );
}
